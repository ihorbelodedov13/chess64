import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Swords, X, UserPlus, Check } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { getCachedInitData, joinGame, acceptFriendRequest, declineFriendRequest } from "../core/api";
import type { JoinGameResponse } from "../types/api";
import type { PlayerColor } from "../stores/useChessStore";
import AvatarWithFrame from "./AvatarWithFrame";
import styles from "./GlobalNotifications.module.scss";

function getWsBaseUrl(): string {
  if (import.meta.env.VITE_WS_BASE_URL) return import.meta.env.VITE_WS_BASE_URL;
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL.replace(/^http/, "ws");
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

interface InviteData {
  game_id: string;
  from_user_id: number;
  from_name: string;
  from_photo: string | null;
  from_frame: number;
}

interface FriendReqData {
  from_user_id: number;
  from_name: string;
  from_photo: string | null;
  from_frame: number;
}

export default function GlobalNotifications() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const [friendReq, setFriendReq] = useState<FriendReqData | null>(null);
  const [friendReqAction, setFriendReqAction] = useState<"idle" | "loading">("idle");

  // Connect notification WebSocket
  useEffect(() => {
    if (!user) return;
    const token = getCachedInitData();
    if (!token) return;

    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const url = `${getWsBaseUrl()}/ws/notify?token=${encodeURIComponent(cleanToken)}`;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "game_invite") {
            setInvite(msg as InviteData);
            setCountdown(30);
          } else if (msg.type === "friend_request") {
            setFriendReq(msg as FriendReqData);
            // Notify Profile page to update badge
            window.dispatchEvent(new Event("friend_request_received"));
          }
        } catch { /* ignore malformed */ }
      };

      ws.onopen = () => {
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25_000);
      };

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        wsRef.current = null;
        setTimeout(connect, 3_000);
      };
    };

    connect();

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user?.id]);

  // Countdown timer when game invite is shown
  useEffect(() => {
    if (!invite) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { setInvite(null); return 30; }
        return c - 1;
      });
    }, 1_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [invite]);

  const handleAcceptGame = useCallback(async () => {
    if (!invite || accepting) return;
    setAccepting(true);
    try {
      const res = await joinGame(invite.game_id);
      const data = res.data as JoinGameResponse;
      setInvite(null);
      navigate("/online-game", {
        state: { gameId: data.game_id, playerColor: data.player_color as PlayerColor, isPrivate: true },
      });
    } catch {
      setInvite(null);
    } finally {
      setAccepting(false);
    }
  }, [invite, accepting, navigate]);

  const handleDeclineGame = useCallback(() => setInvite(null), []);

  const handleAcceptFriend = useCallback(async () => {
    if (!friendReq) return;
    setFriendReqAction("loading");
    try {
      await acceptFriendRequest(friendReq.from_user_id);
    } catch { /* ignore */ }
    setFriendReq(null);
    setFriendReqAction("idle");
  }, [friendReq]);

  const handleDeclineFriend = useCallback(async () => {
    if (!friendReq) return;
    setFriendReqAction("loading");
    try {
      await declineFriendRequest(friendReq.from_user_id);
    } catch { /* ignore */ }
    setFriendReq(null);
    setFriendReqAction("idle");
  }, [friendReq]);

  if (!invite && !friendReq) return null;

  return (
    <>
      {invite && (() => {
        return (
          <div className={styles.overlay}>
            <div className={styles.card}>
              <div className={styles.avatar}>
                <AvatarWithFrame
                  photoUrl={invite.from_photo}
                  firstName={invite.from_name}
                  frame={invite.from_frame ?? 0}
                  size={44}
                />
              </div>
              <div className={styles.body}>
                <p className={styles.label}>Приглашение в партию</p>
                <p className={styles.name}>{invite.from_name}</p>
              </div>
              <span className={styles.countdown}>{countdown}с</span>
              <div className={styles.actions}>
                <button className={styles.accept} onClick={handleAcceptGame} disabled={accepting}>
                  <Swords size={14} />
                  {accepting ? "..." : "Принять"}
                </button>
                <button className={styles.decline} onClick={handleDeclineGame} aria-label="Отклонить">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {friendReq && !invite && (() => {
        return (
          <div className={styles.overlay}>
            <div className={styles.card}>
              <div className={styles.avatar}>
                <AvatarWithFrame
                  photoUrl={friendReq.from_photo}
                  firstName={friendReq.from_name}
                  frame={friendReq.from_frame ?? 0}
                  size={44}
                />
              </div>
              <div className={styles.body}>
                <p className={styles.label}>Запрос в друзья</p>
                <p className={styles.name}>{friendReq.from_name}</p>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.accept}
                  onClick={handleAcceptFriend}
                  disabled={friendReqAction === "loading"}
                >
                  <Check size={14} />
                  Принять
                </button>
                <button
                  className={styles.decline}
                  onClick={handleDeclineFriend}
                  disabled={friendReqAction === "loading"}
                  aria-label="Отклонить"
                >
                  <UserPlus size={14} style={{ transform: "rotate(45deg)" }} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
