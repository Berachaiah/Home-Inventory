from datetime import date
from fastapi import APIRouter, Request, Depends, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User
from auth import verify_password, create_access_token
from web.templating import render
from web.deps import get_web_user

router = APIRouter()

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


@router.get("/login/")
async def login_page(request: Request, next: str = "/dashboard/", user=Depends(get_web_user)):
    if user:
        return RedirectResponse(next, status_code=303)
    return render(request, "accounts/login.html", {"next": next}, user=None, active_nav="login")


@router.post("/login/")
async def login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    next: str = Form("/dashboard/"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password) or not user.is_active:
        return render(
            request, "accounts/login.html",
            {"error": "Invalid username or password. Please try again.", "username": username, "next": next},
            user=None, active_nav="login", status_code=401,
        )
    token = create_access_token({"sub": str(user.id)})
    resp = RedirectResponse(next or "/dashboard/", status_code=303)
    resp.set_cookie(COOKIE_NAME, token, max_age=COOKIE_MAX_AGE, httponly=True, samesite="lax")
    return resp


@router.get("/logout/")
@router.post("/logout/")
async def logout(request: Request):
    resp = RedirectResponse("/login/", status_code=303)
    resp.delete_cookie(COOKIE_NAME)
    return resp
