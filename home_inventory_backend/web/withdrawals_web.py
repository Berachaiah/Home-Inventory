from datetime import date, datetime
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from database import get_db
from models import Item, Batch, WithdrawalLog, User
from web.templating import render
from web.deps import require_login

router = APIRouter()


@router.get("/withdrawals/item-info/")
async def item_info(item_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_login)):
    item = await db.get(Item, item_id, options=[selectinload(Item.batches).selectinload(Batch.withdrawals)])
    if not item:
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"available": item.total_quantity(), "unit_type": item.unit_type, "status": item.stock_status()}


@router.get("/withdrawals/take/")
async def withdraw_page(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_login)):
    items_result = await db.execute(select(Item).options(selectinload(Item.batches).selectinload(Batch.withdrawals)).order_by(Item.name))
    items = [i for i in items_result.scalars().all() if i.total_quantity() > 0]
    return render(request, "withdrawals/withdraw_form.html", {"items": items}, user=user, active_nav="withdraw_item")


@router.post("/withdrawals/take/")
async def withdraw_submit(
    request: Request, item_id: str = Form(...), quantity_taken: float = Form(...),
    purpose: str = Form(""), notes: str = Form(""),
    db: AsyncSession = Depends(get_db), user=Depends(require_login),
):
    errors = {}
    if not item_id:
        errors["item"] = "Please select an item."
    if quantity_taken <= 0:
        errors["quantity_taken"] = "Quantity must be greater than zero."

    batches = []
    if item_id and not errors:
        result = await db.execute(
            select(Batch).options(selectinload(Batch.withdrawals))
            .where(Batch.item_id == int(item_id), Batch.is_active == True)  # noqa: E712
            .order_by(Batch.purchase_date, Batch.created_at)
        )
        batches = result.scalars().all()
        available = sum(b.remaining_units() for b in batches)
        if available < quantity_taken:
            errors["quantity_taken"] = f"Not enough stock: requested {quantity_taken}, only {available} available."

    if errors:
        items_result = await db.execute(select(Item).options(selectinload(Item.batches).selectinload(Batch.withdrawals)).order_by(Item.name))
        items = [i for i in items_result.scalars().all() if i.total_quantity() > 0]
        return render(request, "withdrawals/withdraw_form.html", {"items": items, "errors": errors},
                      user=user, active_nav="withdraw_item", status_code=400)

    remaining_needed = quantity_taken
    for batch in batches:
        if remaining_needed <= 0:
            break
        batch_remaining = batch.remaining_units()
        if batch_remaining <= 0:
            continue
        take = min(batch_remaining, remaining_needed)
        db.add(WithdrawalLog(
            batch_id=batch.id, user_id=user.id, quantity_taken=take,
            quantity_remaining_after=batch_remaining - take, purpose=purpose, notes=notes,
        ))
        remaining_needed -= take

    await db.commit()
    return RedirectResponse("/dashboard/", status_code=303)


@router.get("/withdrawals/log/")
async def withdrawal_log(
    request: Request, q: str = "", user: str = "", date_from: str = "", date_to: str = "",
    db: AsyncSession = Depends(get_db), current_user=Depends(require_login),
):
    query = select(WithdrawalLog).options(
        selectinload(WithdrawalLog.batch).selectinload(Batch.item), selectinload(WithdrawalLog.user)
    )
    if q:
        query = query.join(Batch).join(Item).where(Item.name.ilike(f"%{q}%"))
    if user and current_user.is_manager():
        query = query.where(WithdrawalLog.user_id == int(user))
    if date_from:
        query = query.where(WithdrawalLog.withdrawn_at >= date.fromisoformat(date_from))
    if date_to:
        query = query.where(WithdrawalLog.withdrawn_at <= datetime.fromisoformat(date_to + "T23:59:59"))
    query = query.order_by(WithdrawalLog.withdrawn_at.desc()).limit(300)
    logs = (await db.execute(query)).scalars().all()

    users_list = []
    if current_user.is_manager():
        users_list = (await db.execute(select(User).order_by(User.first_name))).scalars().all()

    return render(request, "withdrawals/withdrawal_log.html", {
        "logs": logs, "total_count": len(logs), "users": users_list,
        "q": q, "selected_user": user, "date_from": date_from, "date_to": date_to,
    }, user=current_user, active_nav="withdrawal_log")
