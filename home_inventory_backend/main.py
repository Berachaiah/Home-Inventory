from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_tables
from routers import auth_routes, catalog_routes, items_routes, batches_routes, restock_routes, assistant_routes, push_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience: creates tables that don't exist yet.
    # Switch to Alembic migrations once the schema stabilizes.
    await create_tables()
    yield


app = FastAPI(title="Home Inventory API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(catalog_routes.router)
app.include_router(items_routes.router)
app.include_router(batches_routes.router)
app.include_router(restock_routes.router)
app.include_router(assistant_routes.router)
app.include_router(push_routes.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
