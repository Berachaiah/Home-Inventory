from datetime import date, datetime, timezone
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from database import get_db
from models import RestockPlan, RestockPlanItem, Item, Batch, StatusEnum
from web.templating import render
from web.deps import require_login, require_manager_web

router = APIRouter()


# ---------------------------------------------------------------- plan list
@router.get("/restock/")
async def plan_list(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_login)):
    result = await db.execute(
        select(RestockPlan).options(selectinload(RestockPlan.items), selectinload(RestockPlan.created_by))
        .order_by(RestockPlan.created_at.desc())
    )
    plans = result.scalars().all()

    items_result = await db.execute(select(Item).options(selectinload(Item.batches).selectinload(Batch.withdrawals)))
    low_count = len([i for i in items_result.scalars().all() if i.stock_status() in ("low", "out")])

    return render(request, "restock/plan_list.html", {"plans": plans, "low_count": low_count}, user=user, active_nav="plan_list")


# -------------------------------------------------------------- plan create
@router.get("/restock/create/")
async def plan_create_page(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    items_result = await db.execute(
        select(Item).options(selectinload(Item.category), selectinload(Item.room), selectinload(Item.batches).selectinload(Batch.withdrawals))
    )
    low_items = [i for i in items_result.scalars().all() if i.stock_status() in ("low", "out")]
    return render(request, "restock/plan_form.html", {"low_items": low_items}, user=user, active_nav="plan_create")


@router.post("/restock/create/")
async def plan_create_submit(
    name: str = Form(...), notes: str = Form(""), auto_add_items: list[str] = Form([]),
    db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    plan = RestockPlan(name=name, notes=notes, created_by_id=user.id)
    db.add(plan)
    await db.flush()  # get plan.id before adding items

    for item_id_str in auto_add_items:
        item = await db.get(Item, int(item_id_str))
        if item:
            deficit = max(1.0, float(item.reorder_threshold) - item.total_quantity())
            db.add(RestockPlanItem(plan_id=plan.id, item_id=item.id, packs_to_buy=round(deficit) or 1, units_per_pack=1))

    await db.commit()
    return RedirectResponse(f"/restock/{plan.id}/", status_code=303)


# -------------------------------------------------------------- plan detail
@router.get("/restock/{plan_id}/")
async def plan_detail(plan_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_login)):
    plan = await db.get(RestockPlan, plan_id, options=[
        selectinload(RestockPlan.items).selectinload(RestockPlanItem.item).selectinload(Item.category),
        selectinload(RestockPlan.items).selectinload(RestockPlanItem.item).selectinload(Item.batches).selectinload(Batch.withdrawals),
        selectinload(RestockPlan.created_by),
    ])
    if not plan:
        return render(request, "404.html", {}, user=user, status_code=404)

    items = plan.items
    pending = [i for i in items if not i.is_restocked]
    restocked = [i for i in items if i.is_restocked]
    total_estimated = sum(i.estimated_cost() for i in pending)
    total_restocked = sum(i.actual_cost() for i in restocked)

    all_items_result = await db.execute(select(Item).order_by(Item.name))
    all_items = all_items_result.scalars().all()

    return render(request, "restock/plan_detail.html", {
        "plan": plan, "items": items, "pending": pending, "restocked": restocked,
        "total_estimated": total_estimated, "total_restocked": total_restocked, "all_items": all_items,
    }, user=user, active_nav="plan_detail")


@router.post("/restock/{plan_id}/")
async def plan_detail_add_item(
    plan_id: int, add_item: str = Form("1"), item_id: str = Form(...),
    packs_to_buy: float = Form(1), units_per_pack: float = Form(1), estimated_price_per_pack: float = Form(0),
    db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    plan = await db.get(RestockPlan, plan_id)
    item = await db.get(Item, int(item_id))
    if plan and item:
        db.add(RestockPlanItem(
            plan_id=plan_id, item_id=item.id, packs_to_buy=packs_to_buy,
            units_per_pack=units_per_pack, estimated_price_per_pack=estimated_price_per_pack,
        ))
        await db.commit()
    return RedirectResponse(f"/restock/{plan_id}/", status_code=303)


# -------------------------------------------------------------- plan delete
@router.get("/restock/{plan_id}/delete/")
async def plan_delete_page(plan_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    plan = await db.get(RestockPlan, plan_id)
    if not plan:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "restock/plan_confirm_delete.html", {"plan": plan}, user=user, active_nav="plan_list")


@router.post("/restock/{plan_id}/delete/")
async def plan_delete_submit(plan_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    plan = await db.get(RestockPlan, plan_id)
    if plan:
        await db.delete(plan)
        await db.commit()
    return RedirectResponse("/restock/", status_code=303)


# --------------------------------------------------------------- plan print
@router.get("/restock/{plan_id}/print/")
async def plan_print(plan_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_login)):
    plan = await db.get(RestockPlan, plan_id, options=[
        selectinload(RestockPlan.items).selectinload(RestockPlanItem.item).selectinload(Item.category),
        selectinload(RestockPlan.items).selectinload(RestockPlanItem.item).selectinload(Item.batches).selectinload(Batch.withdrawals),
    ])
    if not plan:
        return render(request, "404.html", {}, user=user, status_code=404)
    pending = [i for i in plan.items if not i.is_restocked]
    total = sum(i.estimated_cost() for i in pending)
    return render(request, "restock/plan_print.html", {
        "plan": plan, "items": pending, "total": total, "now": datetime.now(),
    }, user=user, active_nav="plan_detail")


# --------------------------------------------------------- plan status update
@router.post("/restock/{plan_id}/status/")
async def plan_update_status(plan_id: int, status: str = Form(...), db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    plan = await db.get(RestockPlan, plan_id)
    if plan:
        try:
            plan.status = StatusEnum(status)
            await db.commit()
        except ValueError:
            pass
    return RedirectResponse(f"/restock/{plan_id}/", status_code=303)


# ------------------------------------------------------------- plan item edit
@router.get("/restock/items/{plan_item_id}/edit/")
async def plan_item_edit_page(plan_item_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    pi = await db.get(RestockPlanItem, plan_item_id, options=[selectinload(RestockPlanItem.item), selectinload(RestockPlanItem.plan)])
    if not pi:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "restock/plan_item_form.html", {"pi": pi}, user=user, active_nav="plan_detail")


@router.post("/restock/items/{plan_item_id}/edit/")
async def plan_item_edit_submit(
    plan_item_id: int, packs_to_buy: float = Form(...), units_per_pack: float = Form(...),
    estimated_price_per_pack: float = Form(0), notes: str = Form(""),
    db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    pi = await db.get(RestockPlanItem, plan_item_id)
    if not pi:
        return RedirectResponse("/restock/", status_code=303)
    pi.packs_to_buy, pi.units_per_pack = packs_to_buy, units_per_pack
    pi.estimated_price_per_pack, pi.notes = estimated_price_per_pack, notes
    await db.commit()
    return RedirectResponse(f"/restock/{pi.plan_id}/", status_code=303)


# ----------------------------------------------------------- plan item delete


@router.post("/restock/items/{plan_item_id}/delete/")
async def plan_item_delete_submit(plan_item_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    pi = await db.get(RestockPlanItem, plan_item_id)
    plan_id = pi.plan_id if pi else None
    if pi:
        await db.delete(pi)
        await db.commit()
    return RedirectResponse(f"/restock/{plan_id}/" if plan_id else "/restock/", status_code=303)


# --------------------------------------------------------------- mark restocked
@router.get("/restock/items/{plan_item_id}/mark-restocked/")
async def mark_restocked_page(plan_item_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    pi = await db.get(RestockPlanItem, plan_item_id, options=[selectinload(RestockPlanItem.item), selectinload(RestockPlanItem.plan)])
    if not pi:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "restock/mark_restocked.html", {"pi": pi, "today": date.today()}, user=user, active_nav="plan_detail")


@router.post("/restock/items/{plan_item_id}/mark-restocked/")
async def mark_restocked_submit(
    plan_item_id: int, actual_purchase_date: date = Form(...), actual_expiry_date: str = Form(""),
    packs_to_buy: float = Form(...), units_per_pack: float = Form(...), actual_price_per_pack: float = Form(0),
    notes: str = Form(""), db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    pi = await db.get(RestockPlanItem, plan_item_id)
    if not pi:
        return RedirectResponse("/restock/", status_code=303)

    expiry = date.fromisoformat(actual_expiry_date) if actual_expiry_date else None
    pi.is_restocked = True
    pi.packs_to_buy, pi.units_per_pack = packs_to_buy, units_per_pack
    pi.actual_price_per_pack = actual_price_per_pack
    pi.actual_purchase_date = actual_purchase_date
    pi.actual_expiry_date = expiry
    pi.restocked_at = datetime.now(timezone.utc)

    db.add(Batch(
        item_id=pi.item_id, purchase_date=actual_purchase_date, expiry_date=expiry,
        pack_quantity=packs_to_buy, units_per_pack=units_per_pack, unit_price=actual_price_per_pack,
        notes=notes or f"Added via Restock Plan #{pi.plan_id}", added_by_id=user.id, is_active=True,
    ))
    await db.commit()
    return RedirectResponse(f"/restock/{pi.plan_id}/", status_code=303)
