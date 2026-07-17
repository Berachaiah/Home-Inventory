"""
Auth dependencies for server-rendered pages.

Browsers navigating between pages don't send an Authorization header, so the
JSON API's bearer-token auth (auth.py) doesn't apply directly to page loads.
Instead, the web login route sets an httpOnly cookie holding the same JWT
used by the API, and these dependencies read it from there.

`auth.get_current_user` was extended to also accept this same cookie as a
fallback, so /api/* endpoints called via fetch() from a page (e.g. the AI
chat widget) keep working without any extra plumbing.
"""
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from config import settings
from jose import JWTError, jwt


class RedirectToLogin(Exception):
    """Raised when a page requires login and no valid session is present.
    Caught by an exception handler in main.py which redirects to /login/."""
    def __init__(self, next_url: str = "/dashboard/"):
        self.next_url = next_url


async def get_web_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Returns the logged-in User, or None. Never raises — use require_login
    for pages that must be behind auth."""
    from models import User
    token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        return None
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        return user
    return None


async def require_login(request: Request, user=Depends(get_web_user)):
    if not user:
        raise RedirectToLogin(next_url=request.url.path)
    return user


async def require_manager_web(user=Depends(require_login)):
    if not user.is_manager():
        raise HTTPException(status_code=403, detail="Manager access required")
    return user


async def require_admin_web(user=Depends(require_login)):
    if not user.is_admin():
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
