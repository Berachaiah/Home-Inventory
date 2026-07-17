from datetime import date
from fastapi import APIRouter, Request, Depends
from web.templating import render
from web.deps import require_manager_web

router = APIRouter()


@router.get("/reports/")
async def report_home(request: Request, user=Depends(require_manager_web)):
    return render(request, "reports/report_home.html", {"today": date.today()}, user=user, active_nav="report_home")
