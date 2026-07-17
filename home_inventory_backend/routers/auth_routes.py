from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User, RoleEnum
from schemas import UserCreate, UserOut, UserUpdate, Token
from auth import hash_password, verify_password, create_access_token, get_current_user, require_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == payload.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    try:
        role = RoleEnum(payload.role)
    except ValueError:
        role = RoleEnum.member

    user = User(
        username=payload.username,
        email=payload.email,
        first_name=payload.first_name or "",
        last_name=payload.last_name or "",
        phone=payload.phone or "",
        hashed_password=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users", response_model=List[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).order_by(User.username))
    return result.scalars().all()


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int, payload: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.role is not None:
        try:
            user.role = RoleEnum(payload.role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role")
    if payload.is_active is not None:
        if user.id == current_user.id and not payload.is_active:
            raise HTTPException(status_code=400, detail="You can't deactivate your own account")
        user.is_active = payload.is_active
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name
    if payload.phone is not None:
        user.phone = payload.phone
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"deleted": True}
