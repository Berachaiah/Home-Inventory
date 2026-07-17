from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from typing import List

from database import get_db
from models import Batch, Item, WithdrawalLog, User
from schemas import BatchCreate, BatchOut, WithdrawalCreate, WithdrawalOut, WithdrawalLogOut
from auth import get_current_user, require_manager

router = APIRouter(prefix="/api", tags=["batches"])


def _serialize_batch(batch: Batch) -> BatchOut:
    out = BatchOut.model_validate(batch)
    out.total_units = batch.total_units()
    out.remaining_units = batch.remaining_units()
    out.total_cost = batch.total_cost()
    out.expiry_status = batch.expiry_status()
    return out


@router.get("/items/{item_id}/batches", response_model=List[BatchOut])
async def list_batches_for_item(item_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Batch)
        .options(selectinload(Batch.withdrawals))
        .where(Batch.item_id == item_id)
        .order_by(Batch.purchase_date, Batch.created_at)
    )
    return [_serialize_batch(b) for b in result.scalars().all()]


@router.post("/batches", response_model=BatchOut)
async def create_batch(payload: BatchCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_manager)):
    item = await db.get(Item, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    batch = Batch(**payload.model_dump(), added_by_id=current_user.id)
    db.add(batch)
    await db.commit()
    await db.refresh(batch, attribute_names=["withdrawals"])
    return _serialize_batch(batch)


@router.get("/withdrawals", response_model=List[WithdrawalLogOut])
async def list_withdrawals(
    item_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = (
        select(WithdrawalLog)
        .options(
            selectinload(WithdrawalLog.batch).selectinload(Batch.item),
            selectinload(WithdrawalLog.user),
        )
        .order_by(WithdrawalLog.withdrawn_at.desc())
        .limit(limit)
    )
    if item_id is not None:
        query = query.join(Batch).where(Batch.item_id == item_id)

    result = await db.execute(query)
    logs = result.scalars().all()

    out = []
    for log in logs:
        entry = WithdrawalLogOut.model_validate(log)
        entry.item_name = log.batch.item.display_name() if log.batch and log.batch.item else ""
        entry.username = log.user.full_name() if log.user else "Unknown"
        out.append(entry)
    return out


@router.post("/withdrawals", response_model=List[WithdrawalOut])
async def withdraw_stock(payload: WithdrawalCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    FIFO consumption: pulls from the oldest active batches (by purchase_date)
    first, splitting the withdrawal across batches if one isn't enough.
    Creates one WithdrawalLog row per batch touched.
    """
    result = await db.execute(
        select(Batch)
        .options(selectinload(Batch.withdrawals))
        .where(Batch.item_id == payload.item_id, Batch.is_active == True)  # noqa: E712
        .order_by(Batch.purchase_date, Batch.created_at)
    )
    batches = result.scalars().all()

    remaining_needed = float(payload.quantity)
    if remaining_needed <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    available = sum(b.remaining_units() for b in batches)
    if available < remaining_needed:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough stock: requested {remaining_needed}, only {available} available",
        )

    logs = []
    for batch in batches:
        if remaining_needed <= 0:
            break
        batch_remaining = batch.remaining_units()
        if batch_remaining <= 0:
            continue
        take = min(batch_remaining, remaining_needed)
        log = WithdrawalLog(
            batch_id=batch.id,
            user_id=current_user.id,
            quantity_taken=take,
            quantity_remaining_after=batch_remaining - take,
            purpose=payload.purpose or "",
            notes=payload.notes or "",
        )
        db.add(log)
        logs.append(log)
        remaining_needed -= take

    await db.commit()
    for log in logs:
        await db.refresh(log)
    return logs


@router.put("/batches/{batch_id}", response_model=BatchOut)
async def update_batch(batch_id: int, payload: BatchCreate, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    result = await db.execute(
        select(Batch).options(selectinload(Batch.withdrawals)).where(Batch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for field, value in payload.model_dump().items():
        setattr(batch, field, value)
    await db.commit()
    await db.refresh(batch, attribute_names=["withdrawals"])
    return _serialize_batch(batch)


@router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    batch = await db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    await db.delete(batch)
    await db.commit()
    return {"deleted": True}
