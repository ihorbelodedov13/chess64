from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with async_session_maker() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        from models import User, Game, Friendship  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        # Safe migrations for columns added after initial deployment
        for sql in [
            "ALTER TABLE games ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT 0",
            "ALTER TABLE friendships ADD COLUMN status VARCHAR NOT NULL DEFAULT 'accepted'",
            "ALTER TABLE users ADD COLUMN selected_frame INTEGER NOT NULL DEFAULT 0",
        ]:
            try:
                await conn.exec_driver_sql(sql)
            except Exception:
                pass
