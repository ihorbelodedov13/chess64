from datetime import datetime
from typing import Literal
from pydantic import BaseModel


# ── Users ──────────────────────────────────────────────────────────────────

class TelegramUser(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None


class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    rating: float
    games_played: int
    last_online: datetime
    online: bool
    wins: int
    losses: int
    draws: int
    created_at: datetime
    selected_frame: int = 0

    model_config = {"from_attributes": True}


class UserStats(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    rating: float
    games_played: int
    wins: int
    losses: int
    draws: int
    last_online: datetime
    online: bool
    selected_frame: int = 0

    model_config = {"from_attributes": True}


# ── Games ──────────────────────────────────────────────────────────────────

class TimeControl(BaseModel):
    base: int = 600
    increment: int = 0


class GameResponse(BaseModel):
    id: str
    status: str
    game_type: str
    white_player_id: int | None
    black_player_id: int | None
    current_fen: str
    time_control: TimeControl
    created_at: datetime
    is_private: bool = False

    model_config = {"from_attributes": True}


class JoinGameResponse(BaseModel):
    game_id: str
    player_color: Literal["white", "black"]
    status: str


class ActiveGameResponse(BaseModel):
    game_id: str
    player_color: Literal["white", "black"]
    status: str
    game_type: str


class CreateGameRequest(BaseModel):
    is_private: bool = False
    time_control: TimeControl = TimeControl()


class CreateBotGameRequest(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    time_control: TimeControl = TimeControl()


class PublicUserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    rating: float
    games_played: int
    wins: int
    losses: int
    draws: int
    online: bool
    selected_frame: int = 0
    # "friends" | "request_sent" | "request_received" | None
    friend_status: str | None = None

    model_config = {"from_attributes": True}


class FriendRequestEntry(BaseModel):
    id: int
    from_user_id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    rating: float
    online: bool
    selected_frame: int = 0
    created_at: datetime


class GameHistoryEntry(BaseModel):
    game_id: str
    opponent_id: int | None
    opponent_name: str | None
    opponent_photo: str | None = None
    player_color: str
    result: str | None   # "win" | "loss" | "draw" | None
    game_type: str
    created_at: datetime
    finished_at: datetime | None


# ── Matchmaking ────────────────────────────────────────────────────────────

class MatchmakingJoinRequest(BaseModel):
    time_control: TimeControl = TimeControl()


class MatchmakingJoinResponse(BaseModel):
    status: Literal["match_found", "waiting"]
    game_id: str | None = None
    opponent_id: int | None = None
    player_color: Literal["white", "black"] | None = None


class MatchmakingStatusResponse(BaseModel):
    status: Literal["in_queue", "not_in_queue"]
    position: int | None = None
    total_in_queue: int | None = None
    game_id: str | None = None
    player_color: Literal["white", "black"] | None = None


# ── WebSocket ─────────────────────────────────────────────────────────────

class MoveHistoryEntry(BaseModel):
    move: str
    player_id: int | None
    timestamp: str
    fen_after: str
    is_bot: bool = False


class WSGameState(BaseModel):
    type: str = "game_state"
    game_id: str
    fen: str
    current_turn: Literal["white", "black"]
    is_check: bool
    is_checkmate: bool
    is_stalemate: bool
    legal_moves: list[str]
    time_white: int
    time_black: int
    move_history: dict
    status: str
    is_game_over: bool


class WSMoveMade(BaseModel):
    type: str = "move_made"
    game_id: str
    fen: str
    current_turn: Literal["white", "black"]
    is_check: bool
    is_checkmate: bool
    is_stalemate: bool
    legal_moves: list[str]
    time_white: int
    time_black: int
    move_history: dict
    status: str
    is_game_over: bool


class WSGameOver(BaseModel):
    type: str = "game_over"
    result: str
    winner: Literal["white", "black"] | None
    rating_change_white: int | None = None
    rating_change_black: int | None = None


class WSError(BaseModel):
    type: str = "error"
    message: str


class WSOpponentConnected(BaseModel):
    type: str = "opponent_connected"


class WSOpponentDisconnected(BaseModel):
    type: str = "opponent_disconnected"


class WSDrawOfferReceived(BaseModel):
    type: str = "draw_offer"
    from_user: int


class WSChatReceived(BaseModel):
    type: str = "chat_message"
    user_id: int
    message: str


class WSAvailableGames(BaseModel):
    type: str = "available_games"
    games: list[dict]
