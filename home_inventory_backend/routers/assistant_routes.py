import json
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from groq import AsyncGroq

from database import get_db
from config import settings
from models import Item, Batch, WithdrawalLog, RestockPlan, RestockPlanItem, User
from schemas import ChatRequest, ChatResponse, PendingAction, ExecuteActionRequest
from auth import get_current_user

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

client = AsyncGroq(api_key=settings.GROQ_API_KEY)
# llama-3.3-70b-versatile was deprecated by Groq on 2026-06-17 (free/developer tier);
# openai/gpt-oss-120b is their recommended replacement with strong tool-use support.
MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """You are the inventory assistant for a household store management app.
You can look up stock levels, low-stock items, and expiring items directly.
For anything that changes data (withdrawing stock, adding a new batch, creating a restock plan),
you must NOT perform it yourself — call the matching propose_* tool instead, which will show the
user a confirmation prompt. Never claim an action was completed unless a tool result says so.
Be concise. Use the user's actual item names and numbers from tool results, don't guess at figures.
When asked for a report for a specific month, call get_monthly_report and share the report_url it returns
as a clickable link in your reply."""

# ---- Read-only tools (executed immediately) ----

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_low_stock_items",
            "description": "List items at or below their reorder threshold.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_expiring_items",
            "description": "List items with a batch expiring soon (within 30 days) or already expired.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_item_stock",
            "description": "Get current stock level and status for a specific item by name (partial match).",
            "parameters": {
                "type": "object",
                "properties": {"item_name": {"type": "string"}},
                "required": ["item_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_monthly_report",
            "description": "Generate a downloadable inventory report link for a given month (or the current month if unspecified).",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string", "description": "e.g. 'June' or '2026-06'. Defaults to current month."},
                    "format": {"type": "string", "enum": ["pdf", "excel"], "description": "Defaults to pdf."},
                },
            },
        },
    },
    # ---- Mutating tools (never executed directly — always proposed for confirmation) ----
    {
        "type": "function",
        "function": {
            "name": "propose_withdraw_stock",
            "description": "Propose withdrawing/using up some quantity of an item. Requires user confirmation before it happens.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {"type": "string"},
                    "quantity": {"type": "number"},
                    "purpose": {"type": "string"},
                },
                "required": ["item_name", "quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_create_batch",
            "description": "Propose adding a new purchased batch of an item to stock. Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {"type": "string"},
                    "pack_quantity": {"type": "number"},
                    "units_per_pack": {"type": "number"},
                    "unit_price": {"type": "number"},
                    "expiry_date": {"type": "string", "description": "YYYY-MM-DD, optional"},
                },
                "required": ["item_name", "pack_quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_create_restock_plan",
            "description": "Propose creating a new restock plan (optionally with a first item on it). Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "item_name": {"type": "string"},
                    "packs_to_buy": {"type": "number"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_mark_restocked",
            "description": "Propose marking an item on an open restock plan as bought, adding it to stock as a new batch. Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {"type": "string", "description": "Name of the item on an open (not yet restocked) restock plan."},
                    "actual_price_per_pack": {"type": "number"},
                    "actual_purchase_date": {"type": "string", "description": "YYYY-MM-DD, optional, defaults to today"},
                    "actual_expiry_date": {"type": "string", "description": "YYYY-MM-DD, optional"},
                },
                "required": ["item_name", "actual_price_per_pack"],
            },
        },
    },
]


async def _find_item(db: AsyncSession, item_name: str) -> Item | None:
    result = await db.execute(
        select(Item).options(selectinload(Item.batches)).where(Item.name.ilike(f"%{item_name}%"))
    )
    return result.scalars().first()


async def _run_readonly_tool(db: AsyncSession, name: str, args: dict) -> dict:
    if name == "get_low_stock_items":
        result = await db.execute(select(Item).options(selectinload(Item.batches)))
        items = result.scalars().all()
        low = [
            {"name": i.display_name(), "total_quantity": i.total_quantity(), "status": i.stock_status()}
            for i in items
            if i.stock_status() in ("out", "low")
        ]
        return {"low_stock_items": low}

    if name == "get_expiring_items":
        result = await db.execute(select(Item).options(selectinload(Item.batches)))
        items = result.scalars().all()
        expiring = [
            {"name": i.display_name(), "earliest_expiry": str(i.earliest_expiry()), "status": i.expiry_status()}
            for i in items
            if i.expiry_status() in ("expired", "critical", "warning")
        ]
        return {"expiring_items": expiring}

    if name == "get_item_stock":
        item = await _find_item(db, args["item_name"])
        if not item:
            return {"error": f"No item found matching '{args['item_name']}'"}
        return {
            "name": item.display_name(),
            "total_quantity": item.total_quantity(),
            "unit_type": item.unit_type,
            "reorder_threshold": float(item.reorder_threshold),
            "stock_status": item.stock_status(),
            "expiry_status": item.expiry_status(),
        }

    if name == "get_monthly_report":
        import calendar
        month_str = args.get("month")
        fmt = args.get("format", "pdf")
        today = date.today()
        if month_str:
            try:
                if "-" in month_str:
                    y, m = map(int, month_str.split("-")[:2])
                else:
                    m = [mn.lower() for mn in calendar.month_name].index(month_str.strip().lower())
                    y = today.year
            except (ValueError, IndexError):
                return {"error": f"Could not parse month '{month_str}', try 'YYYY-MM' or a full month name"}
        else:
            y, m = today.year, today.month
        d_from = date(y, m, 1)
        d_to = date(y, m, calendar.monthrange(y, m)[1])
        url = f"/api/reports/generate?format={fmt}&period=custom&date_from={d_from}&date_to={d_to}"
        return {"report_url": url, "period": f"{d_from} to {d_to}", "format": fmt}

    return {"error": f"Unknown tool {name}"}


def _propose_tool_to_pending_action(name: str, args: dict) -> PendingAction:
    if name == "propose_withdraw_stock":
        qty = args["quantity"]
        item_name = args["item_name"]
        purpose = args.get("purpose", "")
        desc = f"Withdraw {qty} unit(s) of \"{item_name}\""
        if purpose:
            desc += f" for {purpose}"
        desc += ". Confirm?"
        return PendingAction(action_type="withdraw_stock", description=desc, params=args)

    if name == "propose_create_batch":
        desc = (
            f"Add a new batch of \"{args['item_name']}\": "
            f"{args['pack_quantity']} pack(s)"
            + (f" of {args['units_per_pack']} units each" if args.get("units_per_pack") else "")
            + (f" at ₦{args['unit_price']}/pack" if args.get("unit_price") else "")
            + (f", expiring {args['expiry_date']}" if args.get("expiry_date") else "")
            + ". Confirm?"
        )
        return PendingAction(action_type="create_batch", description=desc, params=args)

    if name == "propose_create_restock_plan":
        desc = f"Create restock plan \"{args['name']}\""
        if args.get("item_name"):
            desc += f" with {args.get('packs_to_buy', 1)} pack(s) of \"{args['item_name']}\""
        desc += ". Confirm?"
        return PendingAction(action_type="create_restock_plan", description=desc, params=args)

    if name == "propose_mark_restocked":
        desc = f"Mark \"{args['item_name']}\" as restocked at ₦{args['actual_price_per_pack']}/pack"
        if args.get("actual_expiry_date"):
            desc += f", expiring {args['actual_expiry_date']}"
        desc += ". This will add it to stock. Confirm?"
        return PendingAction(action_type="mark_restocked", description=desc, params=args)

    raise ValueError(f"Unknown proposal tool {name}")


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured on the server")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in payload.history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": payload.message})

    # Allow a couple of tool-call round trips for read-only lookups.
    for _ in range(3):
        response = await client.chat.completions.create(
            model=MODEL, messages=messages, tools=TOOLS, tool_choice="auto"
        )
        choice = response.choices[0].message

        if not choice.tool_calls:
            return ChatResponse(reply=choice.content or "")

        # If the model wants to do a mutating action, stop and hand back a pending confirmation
        # instead of looping further.
        mutating_call = next(
            (tc for tc in choice.tool_calls if tc.function.name.startswith("propose_")), None
        )
        if mutating_call:
            args = json.loads(mutating_call.function.arguments or "{}")
            pending = _propose_tool_to_pending_action(mutating_call.function.name, args)
            return ChatResponse(reply=pending.description, pending_action=pending)

        # Otherwise execute read-only tools and feed results back for a final answer.
        messages.append({
            "role": "assistant",
            "content": choice.content,
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in choice.tool_calls
            ] if choice.tool_calls else None,
        })
        for tc in choice.tool_calls:
            args = json.loads(tc.function.arguments or "{}")
            result = await _run_readonly_tool(db, tc.function.name, args)
            messages.append(
                {"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)}
            )

    return ChatResponse(reply="I looked into that but couldn't put together a final answer — try rephrasing?")


@router.post("/execute")
async def execute_action(
    payload: ExecuteActionRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Executes an action the user has explicitly confirmed in the UI."""
    args = payload.params

    if payload.action_type == "withdraw_stock":
        item = await _find_item(db, args["item_name"])
        if not item:
            raise HTTPException(status_code=404, detail=f"No item found matching '{args['item_name']}'")

        result = await db.execute(
            select(Batch)
            .options(selectinload(Batch.withdrawals))
            .where(Batch.item_id == item.id, Batch.is_active == True)  # noqa: E712
            .order_by(Batch.purchase_date, Batch.created_at)
        )
        batches = result.scalars().all()
        remaining_needed = float(args["quantity"])
        available = sum(b.remaining_units() for b in batches)
        if available < remaining_needed:
            raise HTTPException(status_code=400, detail=f"Not enough stock: requested {remaining_needed}, only {available} available")

        for batch in batches:
            if remaining_needed <= 0:
                break
            batch_remaining = batch.remaining_units()
            if batch_remaining <= 0:
                continue
            take = min(batch_remaining, remaining_needed)
            db.add(WithdrawalLog(
                batch_id=batch.id, user_id=current_user.id, quantity_taken=take,
                quantity_remaining_after=batch_remaining - take,
                purpose=args.get("purpose", ""), notes="via AI assistant",
            ))
            remaining_needed -= take
        await db.commit()
        return {"executed": True, "action_type": payload.action_type}

    if payload.action_type == "create_batch":
        item = await _find_item(db, args["item_name"])
        if not item:
            raise HTTPException(status_code=404, detail=f"No item found matching '{args['item_name']}'")
        expiry = date.fromisoformat(args["expiry_date"]) if args.get("expiry_date") else None
        batch = Batch(
            item_id=item.id,
            purchase_date=date.today(),
            expiry_date=expiry,
            pack_quantity=args.get("pack_quantity", 1),
            units_per_pack=args.get("units_per_pack", 1),
            unit_price=args.get("unit_price", 0),
            added_by_id=current_user.id,
            notes="via AI assistant",
        )
        db.add(batch)
        await db.commit()
        return {"executed": True, "action_type": payload.action_type}

    if payload.action_type == "create_restock_plan":
        plan = RestockPlan(name=args.get("name", "Restock Plan"), created_by_id=current_user.id)
        db.add(plan)
        await db.flush()
        if args.get("item_name"):
            item = await _find_item(db, args["item_name"])
            if item:
                db.add(RestockPlanItem(
                    plan_id=plan.id, item_id=item.id, packs_to_buy=args.get("packs_to_buy", 1),
                ))
        await db.commit()
        return {"executed": True, "action_type": payload.action_type, "plan_id": plan.id}

    if payload.action_type == "mark_restocked":
        item_name = args.get("item_name")
        if not item_name:
            raise HTTPException(status_code=400, detail="item_name is required")

        result = await db.execute(
            select(RestockPlanItem)
            .join(Item, RestockPlanItem.item_id == Item.id)
            .where(Item.name.ilike(f"%{item_name}%"), RestockPlanItem.is_restocked == False)  # noqa: E712
            .order_by(RestockPlanItem.id.desc())
        )
        plan_item = result.scalars().first()
        if not plan_item:
            raise HTTPException(status_code=404, detail=f"No open restock plan item found matching '{item_name}'")

        purchase_date = date.fromisoformat(args["actual_purchase_date"]) if args.get("actual_purchase_date") else date.today()
        expiry_date = date.fromisoformat(args["actual_expiry_date"]) if args.get("actual_expiry_date") else None

        plan_item.is_restocked = True
        plan_item.actual_price_per_pack = args["actual_price_per_pack"]
        plan_item.actual_purchase_date = purchase_date
        plan_item.actual_expiry_date = expiry_date
        plan_item.restocked_at = datetime.now(timezone.utc)

        db.add(Batch(
            item_id=plan_item.item_id,
            purchase_date=purchase_date,
            expiry_date=expiry_date,
            pack_quantity=plan_item.packs_to_buy,
            units_per_pack=plan_item.units_per_pack,
            unit_price=args["actual_price_per_pack"],
            notes=f"Added via Restock Plan #{plan_item.plan_id} (assistant)",
            added_by_id=current_user.id,
            is_active=True,
        ))
        await db.commit()
        return {"executed": True, "action_type": payload.action_type, "item": item_name}

    raise HTTPException(status_code=400, detail=f"Unknown action_type {payload.action_type}")
