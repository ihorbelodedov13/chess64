"""
In-memory registry of user notification WebSocket connections.
Used to push real-time game invites and friend requests to online users.
"""
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class NotificationManager:
    def __init__(self) -> None:
        self._connections: dict[int, WebSocket] = {}

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        old = self._connections.get(user_id)
        if old is not None and old is not ws:
            try:
                await old.close()
            except Exception:
                pass
        self._connections[user_id] = ws
        logger.debug("User %d connected to notifications", user_id)

    def disconnect(self, user_id: int, ws: WebSocket) -> None:
        if self._connections.get(user_id) is ws:
            del self._connections[user_id]
            logger.debug("User %d disconnected from notifications", user_id)

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections

    async def send_invite(
        self,
        target_id: int,
        game_id: str,
        from_user_id: int,
        from_name: str,
        from_photo: str | None,
        from_frame: int = 0,
    ) -> bool:
        ws = self._connections.get(target_id)
        if ws is None:
            return False
        try:
            await ws.send_json({
                "type": "game_invite",
                "game_id": game_id,
                "from_user_id": from_user_id,
                "from_name": from_name,
                "from_photo": from_photo,
                "from_frame": from_frame,
            })
            logger.info("Sent game_invite (game=%s) to user %d via WS", game_id, target_id)
            return True
        except Exception as exc:
            logger.warning("Failed to WS-notify user %d: %s", target_id, exc)
            self.disconnect(target_id, ws)
            return False

    async def send_friend_request(
        self,
        target_id: int,
        from_user_id: int,
        from_name: str,
        from_photo: str | None,
        from_frame: int = 0,
    ) -> bool:
        ws = self._connections.get(target_id)
        if ws is None:
            return False
        try:
            await ws.send_json({
                "type": "friend_request",
                "from_user_id": from_user_id,
                "from_name": from_name,
                "from_photo": from_photo,
                "from_frame": from_frame,
            })
            logger.info("Sent friend_request to user %d via WS", target_id)
            return True
        except Exception as exc:
            logger.warning("Failed to WS-notify (friend_request) user %d: %s", target_id, exc)
            self.disconnect(target_id, ws)
            return False


notification_manager = NotificationManager()
