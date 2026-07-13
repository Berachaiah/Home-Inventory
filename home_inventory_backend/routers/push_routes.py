from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from database import get_db
from config import settings
from models import PushSubscription, Item, User
from schemas import PushSubscriptionCreate
from auth import get_current_user, require_manager
from push import send_to_user, send_to_all

router = APIRouter(prefix="/api/push", tags=["push"])


@router.get("/vapid-public-key")
async def vapid_public_key():
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=500, detail="Push notifications aren't configured on the server")
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe(
    payload: PushSubscriptionCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    existing = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    sub = existing.scalar_one_or_none()
    if sub:
        sub.p256dh = payload.keys.p256dh
        sub.auth = payload.keys.auth
        sub.user_id = current_user.id
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
        )
        db.add(sub)
    await db.commit()
    return {"subscribed": True}


@router.delete("/unsubscribe")
async def unsubscribe(endpoint: str, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == endpoint))
    sub = result.scalar_one_or_none()
    if sub:
        await db.delete(sub)
        await db.commit()
    return {"unsubscribed": True}


@router.post("/test")
async def send_test_notification(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    sent = await send_to_user(db, current_user.id, "Home Inventory", "Push notifications are working.")
    return {"sent": sent}


@router.post("/notify-low-stock")
async def notify_low_stock(db: AsyncSession = Depends(get_db), _=Depends(require_manager)):
    """Manual trigger for now — wire this to a scheduled job (e.g. daily cron) once deployed."""
    result = await db.execute(select(Item).options(selectinload(Item.batches)))
    items = result.scalars().all()

    low = [i for i in items if i.stock_status() in ("out", "low")]
    expiring = [i for i in items if i.expiry_status() in ("expired", "critical")]

    if not low and not expiring:
        return {"sent": 0, "message": "Nothing urgent to report"}

    parts = []
    if low:
        parts.append(f"{len(low)} item(s) low or out of stock: " + ", ".join(i.display_name() for i in low[:5]))
    if expiring:
        parts.append(f"{len(expiring)} item(s) expiring soon: " + ", ".join(i.display_name() for i in expiring[:5]))

    sent = await send_to_all(db, "Stock alert", " | ".join(parts))
    return {"sent": sent}
