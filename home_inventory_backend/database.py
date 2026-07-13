from uuid import uuid4
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from config import settings

db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Serverless (Vercel) functions are short-lived and run many concurrent instances,
# so we use NullPool (no connection pooling on our side - let Supabase's pgbouncer
# handle pooling) and disable asyncpg's prepared statement cache, which pgbouncer's
# transaction mode doesn't support.
engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0, "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__"},
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
