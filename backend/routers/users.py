"""
User social endpoints:
  GET    /users/me/friends           — confirmed friends
  GET    /users/me/friend-requests   — incoming pending requests
  GET    /users/me/games             — my game history
  GET    /users/{id}                 — public profile (with friend_status)
  GET    /users/{id}/games           — another user's game history
  POST   /users/{id}/friend          — send friend request (or accept if reverse exists)
  POST   /users/{id}/friend/accept   — accept incoming request
  POST   /users/{id}/friend/decline  — decline incoming request
  DELETE /users/{id}/friend          — remove friend or cancel sent request
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import User, Game, Friendship
from notification_manager import notification_manager
from schemas import PublicUserResponse, GameHistoryEntry, FriendRequestEntry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _to_public(user: User, friend_status: str | None = None) -> PublicUserResponse:
    return PublicUserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        username=user.username,
        photo_url=user.photo_url,
        rating=user.rating,
        games_played=user.games_played,
        wins=user.wins,
        losses=user.losses,
        draws=user.draws,
        online=user.online,
        friend_status=friend_status,
        selected_frame=user.selected_frame,
    )


async def _get_friendship_status(current_id: int, target_id: int, db: AsyncSession) -> str | None:
    """
    Returns:
      "friends"          — accepted row exists (either direction)
      "request_sent"     — current user sent pending request to target
      "request_received" — target sent pending request to current user
      None               — no relation
    """
    res = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_id, Friendship.friend_id == target_id),
                and_(Friendship.user_id == target_id, Friendship.friend_id == current_id),
            )
        )
    )
    row = res.scalar_one_or_none()
    if row is None:
        return None
    if row.status == "accepted":
        return "friends"
    # pending
    if row.user_id == current_id:
        return "request_sent"
    return "request_received"


async def _games_for(user_id: int, limit: int, offset: int, db: AsyncSession) -> list[GameHistoryEntry]:
    res = await db.execute(
        select(Game)
        .where(
            and_(
                Game.status == "finished",
                or_(Game.white_player_id == user_id, Game.black_player_id == user_id),
            )
        )
        .order_by(Game.finished_at.desc())
        .limit(limit)
        .offset(offset)
    )
    games = res.scalars().all()

    opp_ids = {
        (g.black_player_id if g.white_player_id == user_id else g.white_player_id)
        for g in games
    } - {None}
    users_map: dict[int, User] = {}
    if opp_ids:
        ures = await db.execute(select(User).where(User.id.in_(opp_ids)))
        for u in ures.scalars().all():
            users_map[u.id] = u

    entries = []
    for game in games:
        is_white = game.white_player_id == user_id
        opp_id = game.black_player_id if is_white else game.white_player_id
        opp = users_map.get(opp_id) if opp_id else None

        if game.winner_id == user_id:
            result = "win"
        elif game.winner_id is not None:
            result = "loss"
        elif game.status == "finished":
            result = "draw"
        else:
            result = None

        opp_name: str | None = None
        if opp:
            opp_name = opp.first_name + (f" {opp.last_name}" if opp.last_name else "")
        elif game.game_type == "bot":
            opp_name = "Бот"

        entries.append(GameHistoryEntry(
            game_id=game.id,
            opponent_id=opp_id,
            opponent_name=opp_name,
            opponent_photo=opp.photo_url if opp else None,
            player_color="white" if is_white else "black",
            result=result,
            game_type=game.game_type,
            created_at=game.created_at,
            finished_at=game.finished_at,
        ))
    return entries


# ── /me routes (must be before /{user_id}) ───────────────────────────────────

@router.get("/me/friends", response_model=list[PublicUserResponse])
async def my_friends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all users with whom the current user has an accepted friendship."""
    res = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.status == "accepted",
                or_(Friendship.user_id == user.id, Friendship.friend_id == user.id),
            )
        )
    )
    rows = res.scalars().all()
    friend_ids = [
        r.friend_id if r.user_id == user.id else r.user_id
        for r in rows
    ]
    if not friend_ids:
        return []
    ures = await db.execute(select(User).where(User.id.in_(friend_ids)))
    return [_to_public(f, friend_status="friends") for f in ures.scalars().all()]


@router.get("/me/friend-requests", response_model=list[FriendRequestEntry])
async def my_friend_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns pending friend requests addressed to the current user."""
    res = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.friend_id == user.id,
                Friendship.status == "pending",
            )
        ).order_by(Friendship.created_at.desc())
    )
    rows = res.scalars().all()
    if not rows:
        return []

    sender_ids = [r.user_id for r in rows]
    ures = await db.execute(select(User).where(User.id.in_(sender_ids)))
    senders = {u.id: u for u in ures.scalars().all()}

    result = []
    for row in rows:
        sender = senders.get(row.user_id)
        if sender:
            result.append(FriendRequestEntry(
                id=row.id,
                from_user_id=sender.id,
                first_name=sender.first_name,
                last_name=sender.last_name,
                username=sender.username,
                photo_url=sender.photo_url,
                rating=sender.rating,
                online=sender.online,
                selected_frame=sender.selected_frame,
                created_at=row.created_at,
            ))
    return result


@router.get("/me/games", response_model=list[GameHistoryEntry])
async def my_games(
    limit: int = 30,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _games_for(user.id, limit, offset, db)


# ── /{user_id} routes ────────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=PublicUserResponse)
async def public_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(User).where(User.id == user_id))
    target = res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    status = await _get_friendship_status(current_user.id, user_id, db)
    return _to_public(target, friend_status=status)


@router.get("/{user_id}/games", response_model=list[GameHistoryEntry])
async def user_games(
    user_id: int,
    limit: int = 30,
    offset: int = 0,
    current_user: User = Depends(get_current_user),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    return await _games_for(user_id, limit, offset, db)


@router.post("/{user_id}/friend", status_code=201)
async def send_friend_request(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a friend request. If the target already sent us a request — auto-accept."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    res = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == user_id),
                and_(Friendship.user_id == user_id, Friendship.friend_id == current_user.id),
            )
        )
    )
    existing = res.scalar_one_or_none()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        if existing.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Request already sent")
        # target already sent us a request → auto-accept
        existing.status = "accepted"
        await db.commit()
        return {"status": "accepted"}

    # Create new pending request
    db.add(Friendship(user_id=current_user.id, friend_id=user_id, status="pending"))
    await db.commit()

    # Notify target in real-time if online
    await notification_manager.send_friend_request(
        target_id=user_id,
        from_user_id=current_user.id,
        from_name=current_user.first_name,
        from_photo=current_user.photo_url,
        from_frame=current_user.selected_frame,
    )

    return {"status": "pending"}


@router.post("/{user_id}/friend/accept", status_code=200)
async def accept_friend_request(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept an incoming friend request from user_id."""
    res = await db.execute(
        select(Friendship).where(
            Friendship.user_id == user_id,
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
    )
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="No pending request from this user")
    row.status = "accepted"
    await db.commit()
    return {"status": "accepted"}


@router.post("/{user_id}/friend/decline", status_code=200)
async def decline_friend_request(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decline an incoming friend request from user_id."""
    res = await db.execute(
        select(Friendship).where(
            Friendship.user_id == user_id,
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
    )
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="No pending request from this user")
    await db.delete(row)
    await db.commit()
    return {"status": "declined"}


@router.delete("/{user_id}/friend")
async def remove_friend_or_cancel(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an accepted friendship or cancel a sent request."""
    res = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == user_id),
                and_(Friendship.user_id == user_id, Friendship.friend_id == current_user.id),
            )
        )
    )
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="No friendship or request found")
    await db.delete(row)
    await db.commit()
    return {"status": "removed"}
