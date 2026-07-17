from datetime import date
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from database import get_db
from models import Item, Batch, WithdrawalLog, Category, Room
from web.templating import render
from web.deps import require_login, require_manager_web

router = APIRouter()

UNIT_TYPES = ["pieces", "bottles", "kg", "litres", "packs", "bags", "cans", "boxes"]


# ---------------------------------------------------------------- item list
@router.get("/items/")
async def item_list(
    request: Request, q: str = "", category: str = "", room: str = "", status: str = "",
    db: AsyncSession = Depends(get_db), user=Depends(require_login),
):
    query = select(Item).options(selectinload(Item.category), selectinload(Item.room), selectinload(Item.batches).selectinload(Batch.withdrawals))
    if q:
        query = query.where(Item.name.ilike(f"%{q}%"))
    if category:
        query = query.where(Item.category_id == int(category))
    if room:
        query = query.where(Item.room_id == int(room))
    result = await db.execute(query.order_by(Item.name))
    items = result.scalars().all()

    items_with_status = [(i, i.stock_status(), i.expiry_status()) for i in items]
    if status:
        items_with_status = [t for t in items_with_status if t[1] == status]

    categories = (await db.execute(select(Category).order_by(Category.name))).scalars().all()
    rooms = (await db.execute(select(Room).order_by(Room.name))).scalars().all()

    return render(request, "inventory/item_list.html", {
        "items_with_status": items_with_status,
        "categories": categories, "rooms": rooms,
        "q": q, "selected_category": category, "selected_room": room, "selected_status": status,
    }, user=user, active_nav="item_list")


# -------------------------------------------------------------- item create
@router.get("/items/create/")
async def item_create_page(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    categories = (await db.execute(select(Category).order_by(Category.name))).scalars().all()
    rooms = (await db.execute(select(Room).order_by(Room.name))).scalars().all()
    return render(request, "inventory/item_form.html", {
        "item": None, "categories": categories, "rooms": rooms, "unit_types": UNIT_TYPES, "title": "Add Item",
    }, user=user, active_nav="item_create")


@router.post("/items/create/")
async def item_create_submit(
    request: Request, name: str = Form(...), brand: str = Form(""), category_id: str = Form(""),
    room_id: str = Form(""), unit_type: str = Form("pieces"), reorder_threshold: float = Form(5),
    description: str = Form(""), db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    item = Item(
        name=name, brand=brand,
        category_id=int(category_id) if category_id else None,
        room_id=int(room_id) if room_id else None,
        unit_type=unit_type, reorder_threshold=reorder_threshold, description=description,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return RedirectResponse(f"/items/{item.id}/", status_code=303)


# -------------------------------------------------------------- item detail
@router.get("/items/{item_id}/")
async def item_detail(item_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_login)):
    item = await db.get(Item, item_id, options=[
        selectinload(Item.category), selectinload(Item.room), selectinload(Item.batches).selectinload(Batch.withdrawals),
    ])
    if not item:
        return render(request, "404.html", {}, user=user, status_code=404)

    batches_result = await db.execute(
        select(Batch).options(selectinload(Batch.withdrawals), selectinload(Batch.added_by))
        .where(Batch.item_id == item_id).order_by(Batch.purchase_date, Batch.created_at)
    )
    batches = batches_result.scalars().all()

    withdrawals_result = await db.execute(
        select(WithdrawalLog).join(Batch).options(selectinload(WithdrawalLog.user))
        .where(Batch.item_id == item_id).order_by(WithdrawalLog.withdrawn_at.desc()).limit(20)
    )
    withdrawals = withdrawals_result.scalars().all()

    return render(request, "inventory/item_detail.html", {
        "item": item, "batches": batches, "withdrawals": withdrawals,
    }, user=user, active_nav="item_detail")


# ---------------------------------------------------------------- item edit
@router.get("/items/{item_id}/edit/")
async def item_edit_page(item_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    item = await db.get(Item, item_id)
    if not item:
        return render(request, "404.html", {}, user=user, status_code=404)
    categories = (await db.execute(select(Category).order_by(Category.name))).scalars().all()
    rooms = (await db.execute(select(Room).order_by(Room.name))).scalars().all()
    return render(request, "inventory/item_form.html", {
        "item": item, "categories": categories, "rooms": rooms, "unit_types": UNIT_TYPES, "title": "Edit Item",
    }, user=user, active_nav="item_edit")


@router.post("/items/{item_id}/edit/")
async def item_edit_submit(
    item_id: int, request: Request, name: str = Form(...), brand: str = Form(""), category_id: str = Form(""),
    room_id: str = Form(""), unit_type: str = Form("pieces"), reorder_threshold: float = Form(5),
    description: str = Form(""), db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    item = await db.get(Item, item_id)
    if not item:
        return render(request, "404.html", {}, user=user, status_code=404)
    item.name, item.brand = name, brand
    item.category_id = int(category_id) if category_id else None
    item.room_id = int(room_id) if room_id else None
    item.unit_type, item.reorder_threshold, item.description = unit_type, reorder_threshold, description
    await db.commit()
    return RedirectResponse(f"/items/{item_id}/", status_code=303)


# -------------------------------------------------------------- item delete
@router.get("/items/{item_id}/delete/")
async def item_delete_page(item_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    item = await db.get(Item, item_id)
    if not item:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "inventory/item_confirm_delete.html", {"item": item}, user=user, active_nav="item_list")


@router.post("/items/{item_id}/delete/")
async def item_delete_submit(item_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    item = await db.get(Item, item_id)
    if item:
        await db.delete(item)
        await db.commit()
    return RedirectResponse("/items/", status_code=303)


# ================================================================ batches

@router.get("/items/{item_id}/batches/add/")
async def batch_add_page(item_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    item = await db.get(Item, item_id)
    if not item:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "inventory/batch_form.html", {
        "item": item, "batch": None, "today": date.today(), "title": "Add Stock Batch",
    }, user=user, active_nav="item_detail")


@router.post("/items/{item_id}/batches/add/")
async def batch_add_submit(
    item_id: int, purchase_date: date = Form(...), expiry_date: str = Form(""),
    pack_quantity: float = Form(1), units_per_pack: float = Form(1), unit_price: float = Form(0),
    notes: str = Form(""), db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    batch = Batch(
        item_id=item_id, purchase_date=purchase_date,
        expiry_date=date.fromisoformat(expiry_date) if expiry_date else None,
        pack_quantity=pack_quantity, units_per_pack=units_per_pack, unit_price=unit_price,
        notes=notes, added_by_id=user.id, is_active=True,
    )
    db.add(batch)
    await db.commit()
    return RedirectResponse(f"/items/{item_id}/", status_code=303)


@router.get("/batches/{batch_id}/edit/")
async def batch_edit_page(batch_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    batch = await db.get(Batch, batch_id, options=[selectinload(Batch.item)])
    if not batch:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "inventory/batch_form.html", {
        "item": batch.item, "batch": batch, "today": date.today(), "title": f"Edit Batch #{batch.id}",
    }, user=user, active_nav="item_detail")


@router.post("/batches/{batch_id}/edit/")
async def batch_edit_submit(
    batch_id: int, purchase_date: date = Form(...), expiry_date: str = Form(""),
    pack_quantity: float = Form(1), units_per_pack: float = Form(1), unit_price: float = Form(0),
    notes: str = Form(""), db: AsyncSession = Depends(get_db), user=Depends(require_manager_web),
):
    batch = await db.get(Batch, batch_id)
    if not batch:
        return RedirectResponse("/items/", status_code=303)
    batch.purchase_date = purchase_date
    batch.expiry_date = date.fromisoformat(expiry_date) if expiry_date else None
    batch.pack_quantity, batch.units_per_pack, batch.unit_price, batch.notes = pack_quantity, units_per_pack, unit_price, notes
    await db.commit()
    return RedirectResponse(f"/items/{batch.item_id}/", status_code=303)


@router.get("/batches/{batch_id}/delete/")
async def batch_delete_page(batch_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    batch = await db.get(Batch, batch_id, options=[selectinload(Batch.item)])
    if not batch:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "inventory/batch_confirm_delete.html", {"batch": batch}, user=user, active_nav="item_detail")


@router.post("/batches/{batch_id}/delete/")
async def batch_delete_submit(batch_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_manager_web)):
    batch = await db.get(Batch, batch_id)
    item_id = batch.item_id if batch else None
    if batch:
        await db.delete(batch)
        await db.commit()
    return RedirectResponse(f"/items/{item_id}/" if item_id else "/items/", status_code=303)
