from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import List

from database import get_db
from models import Item
from schemas import ItemCreate, ItemOut
from auth import get_current_user, require_manager

router = APIRouter(prefix="/api/items", tags=["items"])


def _serialize(item: Item) -> ItemOut:
    out = ItemOut.model_validate(item)
    out.total_quantity = item.total_quantity()
    out.stock_status = item.stock_status()
    out.earliest_expiry = item.earliest_expiry()
    out.expiry_status = item.expiry_status()
    return out


@router.get("", response_model=List[ItemOut])
async def list_items(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Item).options(selectinload(Item.batches)).order_by(Item.name)
    )
    return [_serialize(i) for i in result.scalars().all()]


@router.get("/{item_id}", response_model=ItemOut)
async def get_item(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Item).options(selectinload(Item.batches)).where(Item.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize(item)


@router.post("", response_model=ItemOut)
async def create_item(payload: ItemCreate, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    item = Item(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item, attribute_names=["batches"])
    return _serialize(item)


@router.put("/{item_id}", response_model=ItemOut)
async def update_item(item_id: int, payload: ItemCreate, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    result = await db.execute(
        select(Item).options(selectinload(Item.batches)).where(Item.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in payload.model_dump().items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item, attribute_names=["batches"])
    return _serialize(item)


@router.delete("/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()
    return {"deleted": True}
