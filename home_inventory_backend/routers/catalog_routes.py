from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_db
from models import Category, Room, User
from schemas import CategoryCreate, CategoryOut, RoomCreate, RoomOut
from auth import get_current_user, require_manager

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


# ---- Categories ----

@router.get("/categories", response_model=List[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryOut)
async def create_category(payload: CategoryCreate, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    existing = await db.execute(select(Category).where(Category.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Category already exists")
    category = Category(**payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    category = await db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(category)
    await db.commit()
    return {"deleted": True}


# ---- Rooms ----

@router.get("/rooms", response_model=List[RoomOut])
async def list_rooms(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Room).order_by(Room.name))
    return result.scalars().all()


@router.post("/rooms", response_model=RoomOut)
async def create_room(payload: RoomCreate, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    existing = await db.execute(select(Room).where(Room.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Room already exists")
    room = Room(**payload.model_dump())
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


@router.delete("/rooms/{room_id}")
async def delete_room(room_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    await db.delete(room)
    await db.commit()
    return {"deleted": True}
