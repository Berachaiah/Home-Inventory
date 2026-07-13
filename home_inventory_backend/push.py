import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pywebpush import webpush, WebPushException

from config import settings
from models import PushSubscription

logger = logging.getLogger("push")


async def send_to_user(db: AsyncSession, user_id: int, title: str, body: str, url: str = "/") -> int:
    """Sends a push notification to every subscription a user has. Returns count sent."""
    result = await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))
    subs = result.scalars().all()
    return await _send_to_subscriptions(db, subs, title, body, url)


async def send_to_all(db: AsyncSession, title: str, body: str, url: str = "/") -> int:
    result = await db.execute(select(PushSubscription))
    subs = result.scalars().all()
    return await _send_to_subscriptions(db, subs, title, body, url)


async def _send_to_subscriptions(db: AsyncSession, subs, title: str, body: str, url: str) -> int:
    if not settings.VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not configured — skipping push send")
        return 0

    sent = 0
    for sub in subs:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps({"title": title, "body": body, "url": url}),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CLAIMS_EMAIL}"},
            )
            sent += 1
        except WebPushException as e:
            status = e.response.status_code if e.response is not None else None
            if status in (404, 410):
                # Subscription is gone (browser unsubscribed, or expired) — clean it up.
                await db.delete(sub)
            else:
                logger.warning("Push send failed for subscription %s: %s", sub.id, e)
    await db.commit()
    return sent
