import uuid
from datetime import datetime
from sqlalchemy import Integer, String, Float, Boolean, DateTime, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tg_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String, default="Player")
    last_name: Mapped[str | None] = mapped_column(String, nullable=True)
    username: Mapped[str | None] = mapped_column(String, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=1200.0)
    games_played: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)
    online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_online: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    selected_frame: Mapped[int] = mapped_column(Integer, default=0)  # 0 = none, 1-5

    white_games: Mapped[list["Game"]] = relationship("Game", foreign_keys="Game.white_player_id", back_populates="white_player")
    black_games: Mapped[list["Game"]] = relationship("Game", foreign_keys="Game.black_player_id", back_populates="black_player")


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("user_id", "friend_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    friend_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # "pending" — запрос отправлен (user_id → friend_id), "accepted" — дружба подтверждена
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Game(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    status: Mapped[str] = mapped_column(String, default="waiting")  # waiting / active / finished / abandoned
    game_type: Mapped[str] = mapped_column(String, default="human")  # human / bot
    bot_difficulty: Mapped[str | None] = mapped_column(String, nullable=True)

    white_player_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    black_player_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)

    current_fen: Mapped[str] = mapped_column(String, default="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    time_control: Mapped[dict] = mapped_column(JSON, default=lambda: {"base": 600, "increment": 0})
    move_history: Mapped[dict] = mapped_column(JSON, default=dict)

    is_private: Mapped[bool] = mapped_column(Boolean, default=False)

    winner_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    result: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    white_player: Mapped["User | None"] = relationship("User", foreign_keys=[white_player_id], back_populates="white_games")
    black_player: Mapped["User | None"] = relationship("User", foreign_keys=[black_player_id], back_populates="black_games")
