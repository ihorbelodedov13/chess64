"""
In-memory game manager.

Holds live game state (chess.Board, timers, WebSocket connections)
and orchestrates moves, bot turns, broadcasts, etc.
"""
import asyncio
import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

import chess
from fastapi import WebSocket

from schemas import (
    WSGameState, WSMoveMade, WSGameOver,
    WSError, WSOpponentConnected, WSOpponentDisconnected,
    WSDrawOfferReceived, WSChatReceived, WSAvailableGames,
    MoveHistoryEntry,
)
from elo import calculate_new_ratings

if TYPE_CHECKING:
    from models import Game


LOBBY_CONNECTIONS: set[WebSocket] = set()

class EventBus:
    """Simple per-user pub/sub for SSE streams."""

    def __init__(self) -> None:
        self._subs: dict[int, set[asyncio.Queue]] = {}

    def subscribe(self, user_id: int) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs.setdefault(user_id, set()).add(q)
        return q

    def unsubscribe(self, user_id: int, q: asyncio.Queue) -> None:
        subs = self._subs.get(user_id)
        if subs:
            subs.discard(q)

    async def publish(self, user_id: int, payload: dict) -> None:
        for q in list(self._subs.get(user_id, [])):
            await q.put(payload)


event_bus = EventBus()


@dataclass
class ActiveGame:
    game_id: str
    board: chess.Board
    game_type: str  # "human" | "bot"
    bot_difficulty: str | None

    white_player_id: int | None
    black_player_id: int | None

    # WebSocket connections
    white_ws: WebSocket | None = None
    black_ws: WebSocket | None = None

    # Timers (seconds remaining)
    time_white: int = 600
    time_black: int = 600
    time_increment: int = 0
    last_move_time: float = field(default_factory=time.time)
    timer_task: asyncio.Task | None = None
    timer_paused: bool = False
    paused_at: float | None = None

    # Abandonment: task that fires when both players are disconnected for too long
    abandon_task: asyncio.Task | None = None

    # Disconnect-win: task that fires when one player disconnects for too long
    disconnect_task: asyncio.Task | None = None

    # Move history {index: MoveHistoryEntry dict}
    move_history: dict = field(default_factory=dict)

    status: str = "active"

    # Draw offer tracking
    draw_offer_from: int | None = None

    # Player display info (populated on first WS connect from DB)
    white_player_info: dict | None = None
    black_player_info: dict | None = None


class GameManager:
    def __init__(self) -> None:
        self._games: dict[int, ActiveGame] = {}

    def create(
        self,
        game_id: str,
        fen: str,
        game_type: str,
        bot_difficulty: str | None,
        white_player_id: int | None,
        black_player_id: int | None,
        time_control: dict,
    ) -> ActiveGame:
        board = chess.Board(fen)
        ag = ActiveGame(
            game_id=game_id,
            board=board,
            game_type=game_type,
            bot_difficulty=bot_difficulty,
            white_player_id=white_player_id,
            black_player_id=black_player_id,
            time_white=time_control.get("base", 600),
            time_black=time_control.get("base", 600),
            time_increment=time_control.get("increment", 0),
            last_move_time=time.time(),
            move_history={},
        )
        self._games[game_id] = ag
        return ag

    def get(self, game_id: str) -> ActiveGame | None:
        return self._games.get(game_id)

    def remove(self, game_id: str) -> None:
        ag = self._games.pop(game_id, None)
        if ag:
            if ag.timer_task:
                ag.timer_task.cancel()
            if ag.abandon_task and not ag.abandon_task.done():
                ag.abandon_task.cancel()

    # ── helpers ──────────────────────────────────────────────────────────────

    def _get_legal_moves(self, board: chess.Board) -> list[str]:
        return [m.uci() for m in board.legal_moves]

    def _current_times(self, ag: ActiveGame) -> tuple[int, int]:
        """Return actual remaining seconds for (white, black) accounting for elapsed time."""
        if ag.status != "active" or ag.timer_paused:
            return ag.time_white, ag.time_black
        elapsed = int(time.time() - ag.last_move_time)
        if ag.board.turn == chess.WHITE:
            return max(0, ag.time_white - elapsed), ag.time_black
        else:
            return ag.time_white, max(0, ag.time_black - elapsed)

    def _build_game_state_payload(self, ag: ActiveGame) -> dict:
        b = ag.board
        tw, tb = self._current_times(ag)
        payload = WSGameState(
            game_id=ag.game_id,
            fen=b.fen(),
            current_turn="white" if b.turn == chess.WHITE else "black",
            is_check=b.is_check(),
            is_checkmate=b.is_checkmate(),
            is_stalemate=b.is_stalemate(),
            legal_moves=self._get_legal_moves(b),
            time_white=tw,
            time_black=tb,
            move_history=ag.move_history,
            status=ag.status,
            is_game_over=b.is_game_over(),
        ).model_dump()
        if ag.white_player_info is not None:
            payload["white_player"] = ag.white_player_info
        if ag.black_player_info is not None:
            payload["black_player"] = ag.black_player_info
        return payload

    def _build_move_made_payload(self, ag: ActiveGame) -> dict:
        b = ag.board
        tw, tb = self._current_times(ag)
        return WSMoveMade(
            game_id=ag.game_id,
            fen=b.fen(),
            current_turn="white" if b.turn == chess.WHITE else "black",
            is_check=b.is_check(),
            is_checkmate=b.is_checkmate(),
            is_stalemate=b.is_stalemate(),
            legal_moves=self._get_legal_moves(b),
            time_white=tw,
            time_black=tb,
            move_history=ag.move_history,
            status=ag.status,
            is_game_over=b.is_game_over(),
        ).model_dump()

    # ── broadcast ────────────────────────────────────────────────────────────

    async def broadcast(self, ag: ActiveGame, payload: dict) -> None:
        data = json.dumps(payload)
        for ws in [ag.white_ws, ag.black_ws]:
            if ws:
                try:
                    await ws.send_text(data)
                except Exception:
                    pass

    async def send_to(self, ws: WebSocket, payload: dict) -> None:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            pass

    # ── connection management ────────────────────────────────────────────────

    async def connect_player(self, ag: ActiveGame, ws: WebSocket, user_id: int) -> None:
        opponent_ws: WebSocket | None = None

        if ag.white_player_id == user_id:
            ag.white_ws = ws
            opponent_ws = ag.black_ws
        elif ag.black_player_id == user_id:
            ag.black_ws = ws
            opponent_ws = ag.white_ws

        # Cancel abandon countdown if it was running
        if ag.abandon_task and not ag.abandon_task.done():
            ag.abandon_task.cancel()
            ag.abandon_task = None

        # Cancel disconnect-win countdown if opponent reconnected in time
        if ag.disconnect_task and not ag.disconnect_task.done():
            ag.disconnect_task.cancel()
            ag.disconnect_task = None

        # Send current game state to connecting player
        await self.send_to(ws, self._build_game_state_payload(ag))

        # Notify opponent that this player connected
        if opponent_ws:
            await self.send_to(opponent_ws, WSOpponentConnected().model_dump())
            # Also notify this player that the opponent is already connected
            await self.send_to(ws, WSOpponentConnected().model_dump())

        # Resume paused timer when opponent reconnects
        if ag.timer_paused and ag.white_ws and ag.black_ws:
            if ag.paused_at is not None:
                # Shift last_move_time forward by the pause duration so elapsed time
                # doesn't count the disconnection window
                ag.last_move_time += time.time() - ag.paused_at
                ag.paused_at = None
            ag.timer_paused = False

        # Start timer when both connected for the first time (human games)
        # or as soon as the human player connects (bot games)
        if ag.game_type == "bot" and ag.white_ws:
            ag.status = "active"
            if ag.timer_task is None or ag.timer_task.done():
                ag.last_move_time = time.time()
                ag.timer_task = asyncio.create_task(self._run_timers(ag))
        elif ag.game_type == "human" and ag.white_ws and ag.black_ws:
            ag.status = "active"
            if ag.timer_task is None or ag.timer_task.done():
                ag.last_move_time = time.time()
                ag.timer_task = asyncio.create_task(self._run_timers(ag))

    async def disconnect_player(self, ag: ActiveGame, user_id: int) -> None:
        opponent_ws: WebSocket | None = None
        winner_color: str | None = None  # color of the player who STAYED connected

        if ag.white_player_id == user_id:
            ag.white_ws = None
            opponent_ws = ag.black_ws
            winner_color = "black"
        elif ag.black_player_id == user_id:
            ag.black_ws = None
            opponent_ws = ag.white_ws
            winner_color = "white"

        if opponent_ws and ag.status == "active":
            await self.send_to(opponent_ws, WSOpponentDisconnected().model_dump())

        # Pause the timer so the connected player's clock doesn't run
        # while waiting for opponent to reconnect (human games only)
        if ag.game_type == "human" and ag.status == "active":
            ag.timer_paused = True
            ag.paused_at = time.time()
            # Send frozen game state immediately so the frontend sees the paused timer
            if opponent_ws:
                await self.send_to(opponent_ws, self._build_game_state_payload(ag))

        # If both players are now gone, finish the game as abandoned immediately
        if ag.status == "active" and ag.white_ws is None and ag.black_ws is None:
            # Cancel any pending disconnect-win task first
            if ag.disconnect_task and not ag.disconnect_task.done():
                ag.disconnect_task.cancel()
                ag.disconnect_task = None
            if ag.abandon_task is None or ag.abandon_task.done():
                ag.abandon_task = asyncio.create_task(self._abandon_after_timeout(ag, timeout=0))
            return

        # One player disconnected but the opponent is still connected:
        # give them 60 seconds to reconnect, then opponent wins
        if ag.status == "active" and opponent_ws and ag.game_type == "human":
            if ag.disconnect_task is None or ag.disconnect_task.done():
                ag.disconnect_task = asyncio.create_task(
                    self._disconnect_win_after_timeout(ag, winner_color, timeout=60)
                )

    async def _abandon_after_timeout(self, ag: ActiveGame, timeout: int = 30) -> None:
        """Finish the game as abandoned if both players stay disconnected."""
        try:
            await asyncio.sleep(timeout)
        except asyncio.CancelledError:
            return

        # Still no one connected and game is still active — mark as abandoned
        if ag.status == "active" and ag.white_ws is None and ag.black_ws is None:
            ag.status = "finished"
            if ag.timer_task and not ag.timer_task.done():
                ag.timer_task.cancel()

            # Write to DB using a fresh session
            from database import async_session_maker
            from routers.game import _db_update_game
            async with async_session_maker() as db:
                await _db_update_game(
                    ag.game_id, ag.board.fen(), ag.move_history, db,
                    finished=True, winner_color=None, result="abandoned"
                )

            await self._notify_game_finished(ag)

    async def _disconnect_win_after_timeout(
        self, ag: ActiveGame, winner_color: str | None, timeout: int = 60
    ) -> None:
        """After timeout, give the win to the still-connected player."""
        try:
            await asyncio.sleep(timeout)
        except asyncio.CancelledError:
            return

        if ag.status != "active":
            return

        # winner_color == "white" means black disconnected; verify black is still gone
        if winner_color == "white" and ag.black_ws is not None:
            return  # black reconnected in time
        if winner_color == "black" and ag.white_ws is not None:
            return  # white reconnected in time

        ag.status = "finished"
        if ag.timer_task and not ag.timer_task.done():
            ag.timer_task.cancel()

        from database import async_session_maker
        from routers.game import _db_update_game
        async with async_session_maker() as db:
            await _db_update_game(
                ag.game_id, ag.board.fen(), ag.move_history, db,
                finished=True, winner_color=winner_color, result="abandoned"
            )

        await self._notify_game_finished(ag)

    # ── move handling ────────────────────────────────────────────────────────

    async def handle_move(
        self,
        ag: ActiveGame,
        uci_move: str,
        player_id: int,
        db_game_updater=None,  # async callable(game_id, fen, move_history) → None
    ) -> bool:
        board = ag.board

        # Validate it's the player's turn
        turn_is_white = board.turn == chess.WHITE
        if turn_is_white and ag.white_player_id != player_id:
            return False
        if not turn_is_white and ag.black_player_id != player_id:
            return False

        # Parse and validate move
        try:
            move = chess.Move.from_uci(uci_move)
        except ValueError:
            return False

        if move not in board.legal_moves:
            return False

        # Apply time increment for the moving side
        now = time.time()
        elapsed = int(now - ag.last_move_time)
        if turn_is_white:
            ag.time_white = max(0, ag.time_white - elapsed + ag.time_increment)
        else:
            ag.time_black = max(0, ag.time_black - elapsed + ag.time_increment)
        ag.last_move_time = now

        # Record move
        fen_before = board.fen()
        board.push(move)
        move_idx = str(len(ag.move_history))
        ag.move_history[move_idx] = MoveHistoryEntry(
            move=uci_move,
            player_id=player_id,
            timestamp=datetime.utcnow().isoformat(),
            fen_after=board.fen(),
            is_bot=False,
        ).model_dump()

        # Persist to DB
        if db_game_updater:
            await db_game_updater(ag.game_id, board.fen(), ag.move_history)

        # Broadcast move_made to both players
        await self.broadcast(ag, self._build_move_made_payload(ag))

        # Check game over
        if board.is_game_over():
            await self._handle_game_over(ag, db_game_updater)
        elif ag.game_type == "bot":
            # Schedule bot move
            asyncio.create_task(self._bot_move(ag, db_game_updater))

        return True

    async def _bot_move(self, ag: ActiveGame, db_game_updater=None) -> None:
        await asyncio.sleep(0.5)  # brief "thinking" delay

        from bot_engine import get_bot_move_async
        board = ag.board
        move = await get_bot_move_async(board, ag.bot_difficulty or "medium")
        if move is None:
            return

        now = time.time()
        elapsed = int(now - ag.last_move_time)
        if board.turn == chess.WHITE:
            ag.time_white = max(0, ag.time_white - elapsed + ag.time_increment)
        else:
            ag.time_black = max(0, ag.time_black - elapsed + ag.time_increment)
        ag.last_move_time = now

        board.push(move)
        move_idx = str(len(ag.move_history))
        bot_player_id = ag.black_player_id if ag.white_player_id else ag.white_player_id
        ag.move_history[move_idx] = MoveHistoryEntry(
            move=move.uci(),
            player_id=bot_player_id,
            timestamp=datetime.utcnow().isoformat(),
            fen_after=board.fen(),
            is_bot=True,
        ).model_dump()

        if db_game_updater:
            await db_game_updater(ag.game_id, board.fen(), ag.move_history)

        await self.broadcast(ag, self._build_move_made_payload(ag))

        if board.is_game_over():
            await self._handle_game_over(ag, db_game_updater)

    async def _notify_game_finished(self, ag: ActiveGame) -> None:
        """Push a null active-game event to both players via SSE event bus."""
        payload = {"type": "active_game", "game": None}
        for uid in (ag.white_player_id, ag.black_player_id):
            if uid is not None:
                await event_bus.publish(uid, payload)

    async def _persist_timeout(self, ag: ActiveGame, winner_color: str) -> None:
        """Save timeout result to the database."""
        from database import async_session_maker
        from routers.game import _db_update_game
        async with async_session_maker() as db:
            await _db_update_game(
                ag.game_id, ag.board.fen(), ag.move_history, db,
                finished=True, winner_color=winner_color, result="timeout"
            )

    async def _handle_game_over(self, ag: ActiveGame, db_game_updater=None) -> None:
        board = ag.board
        ag.status = "finished"

        if board.is_checkmate():
            winner_color = "black" if board.turn == chess.WHITE else "white"
            result = "checkmate"
        elif board.is_stalemate():
            winner_color = None
            result = "stalemate"
        elif board.is_insufficient_material():
            winner_color = None
            result = "insufficient_material"
        else:
            winner_color = None
            result = "draw"

        delta_white = delta_black = None
        if db_game_updater:
            # rating changes are done in the router layer where we have DB access
            pass

        payload = WSGameOver(
            result=result,
            winner=winner_color,
            rating_change_white=delta_white,
            rating_change_black=delta_black,
        ).model_dump()
        await self.broadcast(ag, payload)

        if db_game_updater:
            await db_game_updater(ag.game_id, board.fen(), ag.move_history, finished=True, winner_color=winner_color, result=result)

        await self._notify_game_finished(ag)

    async def handle_resign(self, ag: ActiveGame, player_id: int, db_game_updater=None) -> None:
        ag.status = "finished"
        winner_color = "black" if ag.white_player_id == player_id else "white"

        payload = WSGameOver(
            result="resignation",
            winner=winner_color,
        ).model_dump()
        await self.broadcast(ag, payload)

        if db_game_updater:
            await db_game_updater(
                ag.game_id, ag.board.fen(), ag.move_history,
                finished=True, winner_color=winner_color, result="resignation"
            )

        await self._notify_game_finished(ag)

    async def handle_draw_offer(self, ag: ActiveGame, from_player_id: int, db_game_updater=None) -> None:
        if ag.draw_offer_from == from_player_id:
            return  # already offered

        # If opponent already offered, accept
        if ag.draw_offer_from is not None and ag.draw_offer_from != from_player_id:
            ag.status = "finished"
            payload = WSGameOver(result="draw", winner=None).model_dump()
            await self.broadcast(ag, payload)
            if db_game_updater:
                await db_game_updater(
                    ag.game_id, ag.board.fen(), ag.move_history,
                    finished=True, winner_color=None, result="draw"
                )
            await self._notify_game_finished(ag)
            return

        ag.draw_offer_from = from_player_id
        opponent_ws = ag.black_ws if ag.white_player_id == from_player_id else ag.white_ws
        if opponent_ws:
            await self.send_to(opponent_ws, WSDrawOfferReceived(from_user=from_player_id).model_dump())

    async def handle_chat(self, ag: ActiveGame, from_player_id: int, message: str) -> None:
        await self.broadcast(ag, WSChatReceived(user_id=from_player_id, message=message).model_dump())

    # ── timers ───────────────────────────────────────────────────────────────

    async def _run_timers(self, ag: ActiveGame) -> None:
        """Decrement active player's clock every second; forfeit on timeout."""
        try:
            while ag.status == "active" and not ag.board.is_game_over():
                await asyncio.sleep(1)
                if ag.status != "active":
                    break

                # Clock is paused while opponent is disconnected
                if ag.timer_paused:
                    continue

                now = time.time()
                elapsed = int(now - ag.last_move_time)

                if ag.board.turn == chess.WHITE:
                    remaining = ag.time_white - elapsed
                    if remaining <= 0:
                        ag.time_white = 0
                        ag.status = "finished"
                        await self.broadcast(ag, WSGameOver(result="timeout", winner="black").model_dump())
                        await self._persist_timeout(ag, winner_color="black")
                        await self._notify_game_finished(ag)
                        break
                else:
                    remaining = ag.time_black - elapsed
                    if remaining <= 0:
                        ag.time_black = 0
                        ag.status = "finished"
                        await self.broadcast(ag, WSGameOver(result="timeout", winner="white").model_dump())
                        await self._persist_timeout(ag, winner_color="white")
                        await self._notify_game_finished(ag)
                        break

                # Broadcast updated timers
                await self.broadcast(ag, self._build_game_state_payload(ag))
        except asyncio.CancelledError:
            pass


# ── Lobby helpers ─────────────────────────────────────────────────────────

async def broadcast_lobby(games: list[dict]) -> None:
    data = json.dumps(WSAvailableGames(games=games).model_dump())
    dead = set()
    for ws in LOBBY_CONNECTIONS:
        try:
            await ws.send_text(data)
        except Exception:
            dead.add(ws)
    LOBBY_CONNECTIONS.difference_update(dead)


game_manager = GameManager()
