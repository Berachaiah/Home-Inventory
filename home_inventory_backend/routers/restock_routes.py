from datetime import date as date_cls, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import List

from database import get_db
from models import RestockPlan, RestockPlanItem, Item, Batch, User, StatusEnum
from schemas import RestockPlanCreate, RestockPlanOut, RestockPlanItemCreate, RestockPlanItemOut
from auth import get_current_user, require_manager

router = APIRouter(prefix="/api/restock", tags=["restock"])


def _serialize_plan(plan: RestockPlan) -> RestockPlanOut:
    out = RestockPlanOut.model_validate(plan)
    out.total_estimated_cost = plan.total_estimated_cost()
    out.total_restocked_cost = plan.total_restocked_cost()
    out.items = []
    for i in plan.items:
        item_out = RestockPlanItemOut.model_validate(i)
        item_out.estimated_cost = i.estimated_cost()
        item_out.actual_cost = i.actual_cost()
        out.items.append(item_out)
    return out


@router.get("", response_model=List[RestockPlanOut])
async def list_plans(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(RestockPlan).options(selectinload(RestockPlan.items)).order_by(RestockPlan.created_at.desc())
    )
    return [_serialize_plan(p) for p in result.scalars().all()]


@router.post("", response_model=RestockPlanOut)
async def create_plan(payload: RestockPlanCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_manager)):
    plan = RestockPlan(**payload.model_dump(), created_by_id=current_user.id)
    db.add(plan)
    await db.commit()
    await db.refresh(plan, attribute_names=["items"])
    return _serialize_plan(plan)


@router.post("/{plan_id}/items", response_model=RestockPlanOut)
async def add_plan_item(plan_id: int, payload: RestockPlanItemCreate, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    plan = await db.get(RestockPlan, plan_id, options=[selectinload(RestockPlan.items)])
    if not plan:
        raise HTTPException(status_code=404, detail="Restock plan not found")
    item = await db.get(Item, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    plan_item = RestockPlanItem(plan_id=plan_id, **payload.model_dump())
    db.add(plan_item)
    await db.commit()
    await db.refresh(plan, attribute_names=["items"])
    return _serialize_plan(plan)


@router.get("/{plan_id}", response_model=RestockPlanOut)
async def get_plan(plan_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    plan = await db.get(RestockPlan, plan_id, options=[selectinload(RestockPlan.items)])
    if not plan:
        raise HTTPException(status_code=404, detail="Restock plan not found")
    return _serialize_plan(plan)


@router.delete("/{plan_id}")
async def delete_plan(plan_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    plan = await db.get(RestockPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Restock plan not found")
    await db.delete(plan)
    await db.commit()
    return {"deleted": True}


@router.delete("/items/{plan_item_id}")
async def delete_plan_item(plan_item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    plan_item = await db.get(RestockPlanItem, plan_item_id)
    if not plan_item:
        raise HTTPException(status_code=404, detail="Restock plan item not found")
    await db.delete(plan_item)
    await db.commit()
    return {"deleted": True}


@router.post("/items/{plan_item_id}/mark-restocked", response_model=RestockPlanItemOut)
async def mark_restocked(
    plan_item_id: int,
    actual_price_per_pack: float,
    actual_purchase_date: str | None = None,
    actual_expiry_date: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    """Marks a plan item restocked AND creates a real Batch from it, mirroring akanbi_inventory."""
    plan_item = await db.get(RestockPlanItem, plan_item_id)
    if not plan_item:
        raise HTTPException(status_code=404, detail="Restock plan item not found")

    purchase_date = date_cls.fromisoformat(actual_purchase_date) if actual_purchase_date else date_cls.today()
    expiry_date = date_cls.fromisoformat(actual_expiry_date) if actual_expiry_date else None

    plan_item.is_restocked = True
    plan_item.actual_price_per_pack = actual_price_per_pack
    plan_item.actual_purchase_date = purchase_date
    plan_item.actual_expiry_date = expiry_date
    plan_item.restocked_at = datetime.now(timezone.utc)

    db.add(Batch(
        item_id=plan_item.item_id,
        purchase_date=purchase_date,
        expiry_date=expiry_date,
        pack_quantity=plan_item.packs_to_buy,
        units_per_pack=plan_item.units_per_pack,
        unit_price=actual_price_per_pack,
        notes=f"Added via Restock Plan #{plan_item.plan_id}",
        added_by_id=current_user.id,
        is_active=True,
    ))

    await db.commit()
    await db.refresh(plan_item)
    out = RestockPlanItemOut.model_validate(plan_item)
    out.estimated_cost = plan_item.estimated_cost()
    out.actual_cost = plan_item.actual_cost()
    return out


@router.put("/{plan_id}/status", response_model=RestockPlanOut)
async def update_status(plan_id: int, status: str, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    plan = await db.get(RestockPlan, plan_id, options=[selectinload(RestockPlan.items)])
    if not plan:
        raise HTTPException(status_code=404, detail="Restock plan not found")
    try:
        plan.status = StatusEnum(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.commit()
    await db.refresh(plan, attribute_names=["items"])
    return _serialize_plan(plan)
