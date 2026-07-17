from fastapi import APIRouter, Request, Depends

from web.templating import render
from web.deps import require_login

router = APIRouter()


@router.get("/agent/")
async def agent_page(request: Request, user=Depends(require_login)):
    return render(
        request, "agent.html",
        context={"hide_assistant": True},
        user=user, active_nav="agent",
    )
