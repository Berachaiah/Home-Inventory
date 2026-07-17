from datetime import date, timedelta
from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from database import get_db
from models import Item, Batch, WithdrawalLog, RestockPlan, StatusEnum
from web.templating import render
from web.deps import require_login

router = APIRouter()


@router.get("/")
async def root_redirect():
    from fastapi.responses import RedirectResponse
    return RedirectResponse("/dashboard/", status_code=303)


@router.get("/dashboard/")
async def dashboard(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_login)):
    items_result = await db.execute(
        select(Item).options(selectinload(Item.category), selectinload(Item.room), selectinload(Item.batches).selectinload(Batch.withdrawals))
    )
    items = items_result.scalars().all()

    total_items = len(items)
    low_stock_items = [i for i in items if i.stock_status() in ("low", "out")]
    low_stock_count = len(low_stock_items)

    today = date.today()
    horizon = today + timedelta(days=30)
    active_batches_result = await db.execute(
        select(Batch).options(selectinload(Batch.item)).where(Batch.is_active == True, Batch.expiry_date != None)  # noqa: E711,E712
    )
    active_batches = active_batches_result.scalars().all()
    expiring_soon = sorted(
        [b for b in active_batches if b.expiry_date and b.expiry_date <= horizon],
        key=lambda b: b.expiry_date,
    )
    expired_count = len([b for b in expiring_soon if b.expiry_date < today])

    restock_cost = 0.0
    if user.is_admin():
        for i in low_stock_items:
            deficit = max(0.0, float(i.reorder_threshold) - i.total_quantity())
            restock_cost += deficit  # rough estimate — no price-per-unit on Item itself

    recent_withdrawals_result = await db.execute(
        select(WithdrawalLog)
        .options(selectinload(WithdrawalLog.batch).selectinload(Batch.item), selectinload(WithdrawalLog.user))
        .order_by(WithdrawalLog.withdrawn_at.desc())
        .limit(10)
    )
    recent_withdrawals = recent_withdrawals_result.scalars().all()

    active_plan = None
    if user.is_manager():
        plan_result = await db.execute(
            select(RestockPlan)
            .options(selectinload(RestockPlan.items))
            .where(RestockPlan.status != StatusEnum.done)
            .order_by(RestockPlan.created_at.desc())
        )
        active_plan = plan_result.scalars().first()

    return render(request, "inventory/dashboard.html", {
        "total_items": total_items,
        "low_stock_items": low_stock_items[:10],
        "low_stock_count": low_stock_count,
        "expiring_soon": expiring_soon[:10],
        "expired_count": expired_count,
        "restock_cost": restock_cost,
        "recent_withdrawals": recent_withdrawals,
        "active_plan": active_plan,
    }, user=user, active_nav="dashboard")
