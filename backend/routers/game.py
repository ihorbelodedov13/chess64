import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from auth import get_current_user
from database import get_db
from models import User, Game
from schemas import (
    GameResponse, JoinGameResponse, CreateGameRequest, CreateBotGameRequest,
    MatchmakingJoinResponse, MatchmakingJoinRequest, MatchmakingStatusResponse, TimeControl,
    ActiveGameResponse,
)
from game_manager import game_manager, broadcast_lobby, event_bus
from elo import calculate_new_ratings
from notification_manager import notification_manager

logger = logging.getLogger(__name__)

_BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
_WEBAPP_URL = os.environ.get("WEBAPP_URL", "http://localhost")

router = APIRouter(prefix="/game", tags=["game"])



# ── helpers ──────────────────────────────────────────────────────────────────

def _game_to_schema(game: Game) -> GameResponse:
    tc = game.time_control or {"base": 600, "increment": 0}
    return GameResponse(
        id=game.id,
        status=game.status,
        game_type=game.game_type,
        white_player_id=game.white_player_id,
        black_player_id=game.black_player_id,
        current_fen=game.current_fen,
        time_control=TimeControl(**tc),
        created_at=game.created_at,
        is_private=game.is_private or False,
    )


async def _broadcast_available(db: AsyncSession) -> None:
    result = await db.execute(
        select(Game, User)
        .join(User, Game.white_player_id == User.id)
        .where(Game.status == "waiting", Game.game_type == "human", Game.is_private == False)  # noqa: E712
    )
    rows = result.all()
    games_list = [
        {
            "id": g.id,
            "white_player": u.first_name,
            "time_control": g.time_control,
            "created_at": g.created_at.isoformat(),
        }
        for g, u in rows
    ]
    await broadcast_lobby(games_list)


async def _db_update_game(
    game_id: str,
    fen: str,
    move_history: dict,
    db: AsyncSession,
    finished: bool = False,
    winner_color: str | None = None,
    result: str | None = None,
) -> None:
    res = await db.execute(select(Game).where(Game.id == game_id))
    game = res.scalar_one_or_none()
    if not game:
        return

    game.current_fen = fen
    game.move_history = move_history

    if finished:
        game.status = "finished"
        game.result = result
        game.finished_at = datetime.utcnow()

        if winner_color == "white":
            game.winner_id = game.white_player_id
        elif winner_color == "black":
            game.winner_id = game.black_player_id

        # ELO updates for human games
        if game.game_type == "human" and game.white_player_id and game.black_player_id:
            w_res = await db.execute(select(User).where(User.id == game.white_player_id))
            b_res = await db.execute(select(User).where(User.id == game.black_player_id))
            white_user = w_res.scalar_one_or_none()
            black_user = b_res.scalar_one_or_none()

            if white_user and black_user:
                elo_result = winner_color if winner_color else "draw"
                dw, db_ = calculate_new_ratings(white_user.rating, black_user.rating, elo_result)

                white_user.rating = max(0.0, white_user.rating + dw)
                black_user.rating = max(0.0, black_user.rating + db_)
                white_user.games_played += 1
                black_user.games_played += 1

                if winner_color == "white":
                    white_user.wins += 1
                    black_user.losses += 1
                elif winner_color == "black":
                    black_user.wins += 1
                    white_user.losses += 1
                else:
                    white_user.draws += 1
                    black_user.draws += 1

                # Push updated rating-change broadcast
                import asyncio
                from schemas import WSGameOver
                ag = game_manager.get(game_id)
                if ag:
                    payload = WSGameOver(
                        result=result or "draw",
                        winner=winner_color,
                        rating_change_white=dw,
                        rating_change_black=db_,
                    ).model_dump()
                    asyncio.create_task(game_manager.broadcast(ag, payload))

    await db.commit()


# ── available games ───────────────────────────────────────────────────────────

@router.get("/available", response_model=list[GameResponse])
async def available_games(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Game).where(
            Game.status == "waiting",
            Game.game_type == "human",
            Game.is_private == False,  # noqa: E712
        )
    )
    return [_game_to_schema(g) for g in result.scalars().all()]


@router.get("/active/stream")
async def active_game_stream(
    token: str = "",
    db: AsyncSession = Depends(get_db),
):
    """SSE stream that pushes active-game updates to the client."""
    from auth import get_ws_user
    user = await get_ws_user(token, db)
    if not user:
        from fastapi import Response
        return Response(status_code=401)
    """SSE stream that pushes active-game updates to the client."""

    async def _current_active(uid: int) -> dict | None:
        res = await db.execute(
            select(Game).where(
                and_(
                    Game.status.in_(["waiting", "active"]),
                    (Game.white_player_id == uid) | (Game.black_player_id == uid),
                )
            )
        )
        game = res.scalars().first()
        if not game:
            return None
        return {
            "game_id": game.id,
            "player_color": "white" if game.white_player_id == uid else "black",
            "status": game.status,
            "game_type": game.game_type,
        }

    async def generate():
        q = event_bus.subscribe(user.id)
        try:
            initial = await _current_active(user.id)
            yield f"data: {json.dumps({'type': 'active_game', 'game': initial})}\n\n"

            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=20)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(user.id, q)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── active game for current user ─────────────────────────────────────────────

@router.get("/active", response_model=ActiveGameResponse | None)
async def get_active_game(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's active (or waiting) game, or null if none."""
    result = await db.execute(
        select(Game).where(
            and_(
                Game.status.in_(["waiting", "active"]),
                (Game.white_player_id == user.id) | (Game.black_player_id == user.id),
            )
        )
    )
    game = result.scalars().first()
    if not game:
        return None

    if game.white_player_id == user.id:
        player_color = "white"
    else:
        player_color = "black"

    return ActiveGameResponse(
        game_id=game.id,
        player_color=player_color,
        status=game.status,
        game_type=game.game_type,
    )


# ── create game ───────────────────────────────────────────────────────────────

async def _send_tg_invite(tg_id: str, inviter_name: str, game_id: str) -> bool:
    """Send a Telegram Bot API message to a user inviting them to join a game."""
    if not _BOT_TOKEN:
        logger.warning("BOT_TOKEN not set — skipping Telegram invite notification")
        return False
    join_url = f"{_WEBAPP_URL}/?startapp={game_id}"
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": tg_id,
                    "text": (
                        f"♟ {inviter_name} приглашает тебя сыграть в шахматы!\n\n"
                        "Нажми кнопку ниже, чтобы присоединиться к партии."
                    ),
                    "reply_markup": {
                        "inline_keyboard": [[
                            {"text": "♟ Вступить в игру", "web_app": {"url": join_url}}
                        ]]
                    },
                },
            )
        if resp.status_code != 200:
            logger.error(
                "Telegram sendMessage failed: HTTP %d — %s (tg_id=%s, game=%s)",
                resp.status_code, resp.text[:300], tg_id, game_id,
            )
            return False
        logger.info("Telegram invite sent to tg_id=%s for game=%s", tg_id, game_id)
        return True
    except Exception as exc:
        logger.error("Exception in _send_tg_invite (tg_id=%s): %s", tg_id, exc)
        return False


# ── invite a specific user ────────────────────────────────────────────────────

@router.post("/invite/{target_user_id}", response_model=GameResponse, status_code=201)
async def invite_user(
    target_user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if target_user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    target = (await db.execute(select(User).where(User.id == target_user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Abort if current user already has an active game
    existing = await db.execute(
        select(Game).where(
            and_(
                Game.status.in_(["waiting", "active"]),
                (Game.white_player_id == user.id) | (Game.black_player_id == user.id),
            )
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="You already have an active game")

    game = Game(
        white_player_id=user.id,
        game_type="human",
        is_private=True,
        time_control=TimeControl().model_dump(),
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)

    # Try WS notification first (user is online in the app)
    ws_sent = await notification_manager.send_invite(
        target_user_id, game.id, user.id, user.first_name, user.photo_url,
        from_frame=user.selected_frame,
    )
    # Fall back to Telegram bot message for offline users
    if not ws_sent:
        await _send_tg_invite(target.tg_id, user.first_name, game.id)

    return _game_to_schema(game)


@router.post("/create", response_model=GameResponse, status_code=201)
async def create_game(
    body: CreateGameRequest = CreateGameRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Game).where(
            and_(
                Game.status.in_(["waiting", "active"]),
                (Game.white_player_id == user.id) | (Game.black_player_id == user.id),
            )
        )
    )
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="You already have an active game")

    game = Game(
        white_player_id=user.id,
        game_type="human",
        is_private=body.is_private,
        time_control=body.time_control.model_dump(),
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)

    if not body.is_private:
        await _broadcast_available(db)
    return _game_to_schema(game)


# ── create bot game ───────────────────────────────────────────────────────────

@router.post("/create/bot", response_model=GameResponse, status_code=201)
async def create_bot_game(
    body: CreateBotGameRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    game = Game(
        white_player_id=user.id,
        game_type="bot",
        bot_difficulty=body.difficulty,
        status="active",
        time_control=body.time_control.model_dump(),
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)

    game_manager.create(
        game_id=game.id,
        fen=game.current_fen,
        game_type="bot",
        bot_difficulty=body.difficulty,
        white_player_id=user.id,
        black_player_id=None,
        time_control=body.time_control.model_dump(),
    )

    return _game_to_schema(game)


# ── matchmaking ───────────────────────────────────────────────────────────────

@router.post("/matchmaking/join", response_model=MatchmakingJoinResponse)
async def matchmaking_join(
    body: MatchmakingJoinRequest = MatchmakingJoinRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Smart matchmaking: join the oldest waiting public game with matching time control,
    otherwise create a new one and wait (visible in games list).
    """
    tc = body.time_control.model_dump()  # {"base": ..., "increment": ...}
    # Prevent joining if user already has an active/waiting game
    existing = await db.execute(
        select(Game).where(
            and_(
                Game.status.in_(["waiting", "active"]),
                (Game.white_player_id == user.id) | (Game.black_player_id == user.id),
            )
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="You already have an active game")

    # Find oldest waiting public game with matching time control
    result = await db.execute(
        select(Game).where(
            and_(
                Game.status == "waiting",
                Game.game_type == "human",
                Game.is_private == False,  # noqa: E712
                Game.white_player_id != user.id,
            )
        ).order_by(Game.created_at.asc())
    )
    # Filter by matching time control in Python
    opponent_game = next(
        (g for g in result.scalars().all()
         if g.time_control and g.time_control.get("base") == tc["base"]
         and g.time_control.get("increment") == tc["increment"]),
        None,
    )

    if opponent_game:
        # Join existing game as black
        opponent_game.black_player_id = user.id
        opponent_game.status = "active"
        await db.commit()
        await db.refresh(opponent_game)

        game_manager.create(
            game_id=opponent_game.id,
            fen=opponent_game.current_fen,
            game_type="human",
            bot_difficulty=None,
            white_player_id=opponent_game.white_player_id,
            black_player_id=user.id,
            time_control=opponent_game.time_control,
        )

        await _broadcast_available(db)
        return MatchmakingJoinResponse(
            status="match_found",
            game_id=opponent_game.id,
            opponent_id=opponent_game.white_player_id,
            player_color="black",
        )

    # No game available — create a new waiting game (visible in list)
    game = Game(
        white_player_id=user.id,
        game_type="human",
        is_private=False,
        time_control=tc,
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)

    await _broadcast_available(db)
    return MatchmakingJoinResponse(
        status="waiting",
        game_id=game.id,
        player_color="white",
    )


# ── join game ─────────────────────────────────────────────────────────────────

@router.post("/{game_id}/join", response_model=JoinGameResponse)
async def join_game(
    game_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.status != "waiting":
        raise HTTPException(status_code=400, detail="Game is not available to join")
    if game.white_player_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot join your own game")

    game.black_player_id = user.id
    game.status = "active"
    await db.commit()
    await db.refresh(game)

    ag = game_manager.get(game_id)
    if ag is None:
        game_manager.create(
            game_id=game.id,
            fen=game.current_fen,
            game_type="human",
            bot_difficulty=None,
            white_player_id=game.white_player_id,
            black_player_id=user.id,
            time_control=game.time_control,
        )
    else:
        ag.black_player_id = user.id

    await _broadcast_available(db)
    return JoinGameResponse(game_id=game.id, player_color="black", status="active")


# ── get game ──────────────────────────────────────────────────────────────────

@router.get("/{game_id}", response_model=GameResponse)
async def get_game(game_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return _game_to_schema(game)


# ── cancel waiting game ───────────────────────────────────────────────────────

@router.post("/{game_id}/cancel")
async def cancel_game(
    game_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a waiting game (only the creator can cancel)."""
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    if game.white_player_id != user.id:
        raise HTTPException(status_code=403, detail="Only the game creator can cancel")
    if game.status != "waiting":
        raise HTTPException(status_code=400, detail="Only waiting games can be cancelled")

    game.status = "abandoned"
    game.finished_at = datetime.utcnow()
    await db.commit()

    # Remove from in-memory manager if present
    game_manager.remove(game_id)

    await _broadcast_available(db)
    return {"status": "cancelled"}


# ── resign ────────────────────────────────────────────────────────────────────

@router.post("/{game_id}/resign")
async def resign(
    game_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ag = game_manager.get(game_id)
    if not ag:
        raise HTTPException(status_code=404, detail="Active game not found")

    async def updater(gid, fen, mh, finished=False, winner_color=None, result=None):
        await _db_update_game(gid, fen, mh, db, finished, winner_color, result)

    await game_manager.handle_resign(ag, user.id, updater)
    return {"status": "ok"}
