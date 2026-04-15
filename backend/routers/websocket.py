"""
WebSocket routers:
  /ws/game/{game_id}?token=...   – real-time game play
  /ws/lobby?token=...            – lobby (available games list)
"""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_maker
from auth import get_ws_user
from models import Game, User
from game_manager import game_manager, LOBBY_CONNECTIONS
from notification_manager import notification_manager
from schemas import WSError

router = APIRouter(tags=["websocket"])


async def _make_db_updater(game_id: str):
    """Return a closure that opens its own DB session for updates."""
    async def updater(
        gid: int,
        fen: str,
        move_history: dict,
        finished: bool = False,
        winner_color: str | None = None,
        result: str | None = None,
    ) -> None:
        async with async_session_maker() as db:
            from routers.game import _db_update_game
            await _db_update_game(gid, fen, move_history, db, finished, winner_color, result)
    return updater


# ── Game WebSocket ────────────────────────────────────────────────────────────

@router.websocket("/ws/game/{game_id}")
async def ws_game(websocket: WebSocket, game_id: str, token: str = ""):
    await websocket.accept()

    async with async_session_maker() as db:
        user = await get_ws_user(token, db)
        if not user:
            await websocket.send_text(json.dumps(WSError(message="Unauthorized").model_dump()))
            await websocket.close(code=1008)
            return

        # Load game into manager if not already there
        ag = game_manager.get(game_id)
        if ag is None:
            result = await db.execute(select(Game).where(Game.id == game_id))
            game = result.scalar_one_or_none()
            if not game:
                await websocket.send_text(json.dumps(WSError(message="Game not found").model_dump()))
                await websocket.close()
                return

            ag = game_manager.create(
                game_id=game.id,
                fen=game.current_fen,
                game_type=game.game_type,
                bot_difficulty=game.bot_difficulty,
                white_player_id=game.white_player_id,
                black_player_id=game.black_player_id,
                time_control=game.time_control or {"base": 600, "increment": 0},
            )
            ag.move_history = game.move_history or {}

        # Populate player display info (once per game lifetime)
        if ag.white_player_info is None and ag.white_player_id:
            wu = await db.get(User, ag.white_player_id)
            if wu:
                ag.white_player_info = {
                    "name": wu.first_name + (f" {wu.last_name}" if wu.last_name else ""),
                    "photo": wu.photo_url,
                    "rating": round(wu.rating),
                    "frame": wu.selected_frame,
                    "is_bot": False,
                }
        if ag.black_player_info is None:
            if ag.game_type == "bot":
                ag.black_player_info = {
                    "name": "Бот",
                    "photo": None,
                    "rating": 0,
                    "frame": 0,
                    "is_bot": True,
                }
            elif ag.black_player_id:
                bu = await db.get(User, ag.black_player_id)
                if bu:
                    ag.black_player_info = {
                        "name": bu.first_name + (f" {bu.last_name}" if bu.last_name else ""),
                        "photo": bu.photo_url,
                        "rating": round(bu.rating),
                        "frame": bu.selected_frame,
                        "is_bot": False,
                    }

    # Ensure user is a participant
    if user.id not in (ag.white_player_id, ag.black_player_id):
        await websocket.send_text(json.dumps(WSError(message="Not a participant").model_dump()))
        await websocket.close()
        return

    await game_manager.connect_player(ag, websocket, user.id)

    db_updater = await _make_db_updater(game_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await game_manager.send_to(websocket, WSError(message="Invalid JSON").model_dump())
                continue

            msg_type = msg.get("type")

            if msg_type == "move":
                ok = await game_manager.handle_move(ag, msg.get("move", ""), user.id, db_updater)
                if not ok:
                    await game_manager.send_to(websocket, WSError(message="Illegal move").model_dump())

            elif msg_type == "resign":
                await game_manager.handle_resign(ag, user.id, db_updater)

            elif msg_type == "draw_offer":
                await game_manager.handle_draw_offer(ag, user.id, db_updater)

            elif msg_type == "chat_message":
                await game_manager.handle_chat(ag, user.id, msg.get("message", ""))

            elif msg_type == "timer_ping":
                await game_manager.send_to(websocket, game_manager._build_game_state_payload(ag))

    except WebSocketDisconnect:
        await game_manager.disconnect_player(ag, user.id)


# ── Lobby WebSocket ───────────────────────────────────────────────────────────

@router.websocket("/ws/lobby")
async def ws_lobby(websocket: WebSocket, token: str = ""):
    await websocket.accept()

    async with async_session_maker() as db:
        user = await get_ws_user(token, db)
        if not user:
            await websocket.send_text(json.dumps(WSError(message="Unauthorized").model_dump()))
            await websocket.close(code=1008)
            return

    LOBBY_CONNECTIONS.add(websocket)

    try:
        while True:
            # Keep alive; lobby updates are pushed from game router
            await websocket.receive_text()
    except WebSocketDisconnect:
        LOBBY_CONNECTIONS.discard(websocket)


# ── Notification WebSocket ────────────────────────────────────────────────────

@router.websocket("/ws/notify")
async def ws_notify(websocket: WebSocket, token: str = ""):
    """Per-user notification channel (game invites, etc.)."""
    await websocket.accept()

    async with async_session_maker() as db:
        user = await get_ws_user(token, db)
        if not user:
            await websocket.send_text(json.dumps({"type": "error", "message": "Unauthorized"}))
            await websocket.close(code=1008)
            return

    await notification_manager.connect(user.id, websocket)

    try:
        while True:
            # Keep-alive: client sends "ping" every ~25 s
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(user.id, websocket)
