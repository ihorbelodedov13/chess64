"""
Auth module.

Dev mode  : any Bearer string is treated as the username (player1 → dev_player1).
Production: parse Telegram WebApp initData and verify HMAC-SHA256 against BOT_TOKEN.

Telegram initData verification spec:
  https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hashlib
import hmac
import json
from datetime import datetime
from urllib.parse import parse_qs, unquote

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from database import get_db
from models import User


# ── Dev mode helpers ──────────────────────────────────────────────────────────

def _user_from_dev_token(token: str) -> dict:
    clean = token.strip()
    return {
        "tg_id": f"dev_{clean}",
        "first_name": clean.replace("_", " ").title(),
        "username": clean,
    }


# ── Telegram initData ─────────────────────────────────────────────────────────

def _verify_init_data_hash(init_data: str, bot_token: str) -> bool:
    """Return True if the HMAC signature in initData is valid."""
    params = dict(parse_qs(init_data, keep_blank_values=True))
    flat = {k: v[0] for k, v in params.items()}

    received_hash = flat.pop("hash", None)
    if not received_hash:
        return False

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(flat.items()))

    # secret_key = HMAC-SHA256("WebAppData", bot_token)
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    return hmac.compare_digest(expected_hash, received_hash)


def _parse_init_data(init_data: str, bot_token: str) -> dict | None:
    """Parse Telegram initData, verify hash, return user info dict or None."""
    try:
        if not _verify_init_data_hash(init_data, bot_token):
            return None

        params = dict(parse_qs(init_data, keep_blank_values=True))
        flat = {k: v[0] for k, v in params.items()}
        user_data = json.loads(unquote(flat.get("user", "{}")))

        return {
            "tg_id": str(user_data.get("id", "")),
            "first_name": user_data.get("first_name", "Player"),
            "last_name": user_data.get("last_name"),
            "username": user_data.get("username"),
            "photo_url": user_data.get("photo_url"),
        }
    except Exception:
        return None


# ── DB helper ─────────────────────────────────────────────────────────────────

async def _get_or_create_user(db: AsyncSession, user_info: dict) -> User:
    tg_id = user_info["tg_id"]
    result = await db.execute(select(User).where(User.tg_id == tg_id))
    user = result.scalar_one_or_none()

    now = datetime.utcnow()

    if user is None:
        user = User(
            tg_id=tg_id,
            first_name=user_info.get("first_name", "Player"),
            last_name=user_info.get("last_name"),
            username=user_info.get("username"),
            photo_url=user_info.get("photo_url"),
            online=True,
            last_online=now,
        )
        db.add(user)
    else:
        user.online = True
        user.last_online = now

    await db.commit()
    await db.refresh(user)
    return user


# ── FastAPI dependencies ──────────────────────────────────────────────────────

async def get_current_user(
    authorization: str = Header(default=""),
    x_api_key: str = Header(default="", alias="x-api-key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if x_api_key and x_api_key != settings.api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")

    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is empty")

    if settings.dev_mode:
        user_info = _user_from_dev_token(token)
    else:
        if not settings.bot_token:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="BOT_TOKEN is not configured on the server",
            )
        user_info = _parse_init_data(token, settings.bot_token)
        if not user_info:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram initData")

    return await _get_or_create_user(db, user_info)


async def get_ws_user(token: str, db: AsyncSession) -> User | None:
    """Authenticate user for WebSocket connections (token passed as query param)."""
    if not token:
        return None

    if settings.dev_mode:
        user_info = _user_from_dev_token(token)
    else:
        if not settings.bot_token:
            return None
        user_info = _parse_init_data(token, settings.bot_token)
        if not user_info:
            return None

    return await _get_or_create_user(db, user_info)
