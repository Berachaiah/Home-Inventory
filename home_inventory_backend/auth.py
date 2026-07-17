from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import settings
from database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False so this also works for browser page requests (cookie auth,
# no Authorization header) via the fallback in get_current_user() below.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)
def hash_password(password): return pwd_context.hash(password)

def create_access_token(data, expires_delta=None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

async def get_current_user(request: Request, token=Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    from models import User
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    # Prefer the Authorization header (API/mobile clients); fall back to the
    # httpOnly session cookie set by the web login page.
    raw_token = token or request.cookies.get("access_token")
    if not raw_token:
        raise exc
    try:
        payload = jwt.decode(raw_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None: raise exc
    except JWTError: raise exc
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active: raise exc
    return user

def require_manager(current_user=Depends(get_current_user)):
    if not current_user.is_manager(): raise HTTPException(status_code=403, detail="Manager access required")
    return current_user

def require_admin(current_user=Depends(get_current_user)):
    if not current_user.is_admin(): raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
