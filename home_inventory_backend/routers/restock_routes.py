from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import List

from database import get_db
from models import RestockPlan, RestockPlanItem, Item, User, StatusEnum
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


@router.post("/items/{plan_item_id}/mark-restocked", response_model=RestockPlanItemOut)
async def mark_restocked(
    plan_item_id: int,
    actual_price_per_pack: float,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_manager),
):
    plan_item = await db.get(RestockPlanItem, plan_item_id)
    if not plan_item:
        raise HTTPException(status_code=404, detail="Restock plan item not found")
    plan_item.is_restocked = True
    plan_item.actual_price_per_pack = actual_price_per_pack
    plan_item.restocked_at = datetime.now(timezone.utc)
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
