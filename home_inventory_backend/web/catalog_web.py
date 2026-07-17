from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Category, Room
from web.templating import render
from web.deps import require_manager_web

router = APIRouter()


@router.get("/categories/")
async def category_list(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    categories = (await db.execute(select(Category).order_by(Category.name))).scalars().all()
    return render(request, "inventory/category_list.html", {"categories": categories}, user=user, active_nav="category_list")


@router.post("/categories/")
async def category_create(
    name: str = Form(...), description: str = Form(""),
    db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    existing = (await db.execute(select(Category).where(Category.name == name))).scalar_one_or_none()
    if not existing:
        db.add(Category(name=name, description=description))
        await db.commit()
    return RedirectResponse("/categories/", status_code=303)


@router.post("/categories/{category_id}/delete/")
async def category_delete(category_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    category = await db.get(Category, category_id)
    if category:
        await db.delete(category)
        await db.commit()
    return RedirectResponse("/categories/", status_code=303)


@router.get("/rooms/")
async def room_list(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    rooms = (await db.execute(select(Room).order_by(Room.name))).scalars().all()
    return render(request, "inventory/room_list.html", {"rooms": rooms}, user=user, active_nav="room_list")


@router.post("/rooms/")
async def room_create(
    name: str = Form(...), description: str = Form(""),
    db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    existing = (await db.execute(select(Room).where(Room.name == name))).scalar_one_or_none()
    if not existing:
        db.add(Room(name=name, description=description))
        await db.commit()
    return RedirectResponse("/rooms/", status_code=303)


@router.post("/rooms/{room_id}/delete/")
async def room_delete(room_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    room = await db.get(Room, room_id)
    if room:
        await db.delete(room)
        await db.commit()
    return RedirectResponse("/rooms/", status_code=303)
