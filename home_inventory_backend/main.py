from contextlib import asynccontextmanager
from fastapi.responses import FileResponse
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from config import settings
from database import create_tables
from routers import auth_routes, catalog_routes, items_routes, batches_routes, restock_routes, assistant_routes, reports_routes
try:
    from routers import push_routes
except ModuleNotFoundError:
    push_routes = None  # push.py wasn't part of this migration; add it back and this will pick up automatically
from web import auth_web, dashboard, items_web, withdrawals_web, catalog_web, restock_web, users_web, reports_web, agent_web
from web.deps import RedirectToLogin
from web.templating import render


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience: creates tables that don't exist yet.
    # Switch to Alembic migrations once the schema stabilizes.
    await create_tables()
    yield


app = FastAPI(title="Home Inventory", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="home_inventory_backend/static"), name="static")

@app.api_route("/sw.js", methods=["GET", "HEAD"], include_in_schema=False)
async def service_worker():
    return FileResponse(
        "static/sw.js",
        media_type="application/javascript",
    )

@app.api_route("/manifest.json", methods=["GET", "HEAD"], include_in_schema=False)
async def manifest():
    return FileResponse(
        "manifest.json",
        media_type="application/manifest+json",
    )


# ---- JSON API (unchanged, bearer-token auth; also now accepts the web session cookie) ----
app.include_router(auth_routes.router)
app.include_router(catalog_routes.router)
app.include_router(items_routes.router)
app.include_router(batches_routes.router)
app.include_router(restock_routes.router)
app.include_router(assistant_routes.router)
if push_routes:
    app.include_router(push_routes.router)
app.include_router(reports_routes.router)

# ---- Server-rendered pages (cookie auth) ----
app.include_router(auth_web.router)
app.include_router(dashboard.router)
app.include_router(agent_web.router)
app.include_router(items_web.router)
app.include_router(withdrawals_web.router)
app.include_router(catalog_web.router)
app.include_router(restock_web.router)
app.include_router(users_web.router)
app.include_router(reports_web.router)


@app.exception_handler(RedirectToLogin)
async def redirect_to_login_handler(request: Request, exc: RedirectToLogin):
    return RedirectResponse(f"/login/?next={exc.next_url}", status_code=303)


@app.exception_handler(HTTPException)
async def html_http_exception_handler(request: Request, exc: HTTPException):
    # API routes (prefixed /api/) keep the default JSON error body.
    if request.url.path.startswith("/api/"):
        from fastapi.exception_handlers import http_exception_handler
        return await http_exception_handler(request, exc)

    # Best-effort: resolve the logged-in user so base.html's nav (which
    # assumes a logged-in user when `user` is truthy) doesn't crash on a
    # bare 404/403 reached outside any page dependency chain.
    from web.deps import get_web_user
    from database import AsyncSessionLocal
    user = None
    try:
        async with AsyncSessionLocal() as db:
            user = await get_web_user(request, db)
    except Exception:
        pass

    status_code = exc.status_code if exc.status_code in (403, 404) else 404
    return render(request, "404.html", {"detail": exc.detail}, user=user, status_code=status_code)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/manifest.json")
async def manifest():
    return FileResponse("manifest.json", media_type="application/manifest+json")
