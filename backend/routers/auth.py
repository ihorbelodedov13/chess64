from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from auth import get_current_user
from database import get_db
from models import User
from schemas import TelegramUser, UserResponse, UserStats

router = APIRouter(prefix="/auth", tags=["auth"])

ONLINE_THRESHOLD = timedelta(minutes=5)


@router.get("/", response_model=TelegramUser)
async def auth(user: User = Depends(get_current_user)):
    """Return basic Telegram user info (or dev user)."""
    return TelegramUser(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        username=user.username,
        photo_url=user.photo_url,
    )


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.get("/{user_id}/stats", response_model=UserStats)
async def user_stats(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _current: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.online = (datetime.utcnow() - user.last_online) < ONLINE_THRESHOLD
    return user


class FrameUpdate(BaseModel):
    frame: int  # 0 = none, 1-5


@router.patch("/me/frame", response_model=UserResponse)
async def update_frame(
    body: FrameUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.frame < 0 or body.frame > 5:
        raise HTTPException(status_code=400, detail="Invalid frame index")
    user.selected_frame = body.frame
    await db.commit()
    await db.refresh(user)
    return user
