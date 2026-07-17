from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, RoleEnum
from auth import hash_password
from web.templating import render
from web.deps import require_admin_web

router = APIRouter()


@router.get("/users/")
async def user_list(request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_admin_web)):
    users = (await db.execute(select(User).order_by(User.first_name, User.username))).scalars().all()
    return render(request, "accounts/user_list.html", {"users": users}, user=user, active_nav="user_list")


@router.get("/users/create/")
async def user_create_page(request: Request, user=Depends(require_admin_web)):
    return render(request, "accounts/user_form.html", {"user_obj": None, "title": "Add User"}, user=user, active_nav="user_create")


@router.post("/users/create/")
async def user_create_submit(
    request: Request, username: str = Form(...), password: str = Form(...), email: str = Form(""),
    first_name: str = Form(""), last_name: str = Form(""), phone: str = Form(""),
    role: str = Form("member"), db: AsyncSession = Depends(get_db), user=Depends(require_admin_web),
):
    existing = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
    if existing:
        return render(request, "accounts/user_form.html", {
            "user_obj": None, "title": "Add User", "errors": {"username": "Username already taken."},
        }, user=user, active_nav="user_create", status_code=400)
    new_user = User(
        username=username, hashed_password=hash_password(password), email=email,
        first_name=first_name, last_name=last_name, phone=phone, role=RoleEnum(role), is_active=True,
    )
    db.add(new_user)
    await db.commit()
    return RedirectResponse("/users/", status_code=303)


@router.get("/users/{user_id}/edit/")
async def user_edit_page(user_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_admin_web)):
    user_obj = await db.get(User, user_id)
    if not user_obj:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "accounts/user_form.html", {"user_obj": user_obj, "title": "Edit User"}, user=user, active_nav="user_edit")


@router.post("/users/{user_id}/edit/")
async def user_edit_submit(
    user_id: int, request: Request, email: str = Form(""), first_name: str = Form(""), last_name: str = Form(""),
    phone: str = Form(""), role: str = Form("member"), is_active: bool = Form(False),
    db: AsyncSession = Depends(get_db), user=Depends(require_admin_web),
):
    user_obj = await db.get(User, user_id)
    if not user_obj:
        return render(request, "404.html", {}, user=user, status_code=404)
    user_obj.email, user_obj.first_name, user_obj.last_name, user_obj.phone = email, first_name, last_name, phone
    user_obj.role, user_obj.is_active = RoleEnum(role), is_active
    await db.commit()
    return RedirectResponse("/users/", status_code=303)


@router.get("/users/{user_id}/delete/")
async def user_delete_page(user_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(require_admin_web)):
    user_obj = await db.get(User, user_id)
    if not user_obj:
        return render(request, "404.html", {}, user=user, status_code=404)
    return render(request, "accounts/user_confirm_delete.html", {"user_obj": user_obj}, user=user, active_nav="user_list")


@router.post("/users/{user_id}/delete/")
async def user_delete_submit(user_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_admin_web)):
    if user_id == user.id:
        return RedirectResponse("/users/", status_code=303)  # can't remove yourself
    user_obj = await db.get(User, user_id)
    if user_obj:
        await db.delete(user_obj)
        await db.commit()
    return RedirectResponse("/users/", status_code=303)
