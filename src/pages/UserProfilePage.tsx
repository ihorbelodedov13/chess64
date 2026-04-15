import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";
import {
  fetchPublicProfile,
  fetchUserGames,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  inviteUserToGame,
} from "../core/api";
import type { PublicUserResponse, GameHistoryEntry } from "../types/api";
import { Crown, UserPlus, UserMinus, ChevronRight, Swords, Check, X, Clock } from "lucide-react";
import AvatarWithFrame from "../components/AvatarWithFrame";
import styles from "./Profile.module.scss";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} д. назад`;
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAppStore();

  const [profile, setProfile] = useState<PublicUserResponse | null>(null);
  const [games, setGames] = useState<GameHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [friendStatus, setFriendStatus] = useState<"friends" | "request_sent" | "request_received" | null>(null);
  const [friendLoading, setFriendLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const numId = Number(userId);

  // Redirect to own profile
  useEffect(() => {
    if (currentUser && numId === currentUser.id) {
      navigate("/profile", { replace: true });
    }
  }, [numId, currentUser, navigate]);

  useEffect(() => {
    if (!numId) return;
    setLoading(true);
    fetchPublicProfile(numId)
      .then(r => {
        setProfile(r.data);
        setFriendStatus(r.data.friend_status ?? null);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));

    setGamesLoading(true);
    fetchUserGames(numId)
      .then(r => setGames(r.data))
      .catch(() => setGames([]))
      .finally(() => setGamesLoading(false));
  }, [numId]);

  const handleAddFriend = useCallback(async () => {
    if (!profile) return;
    setFriendLoading(true);
    try {
      const res = await sendFriendRequest(profile.id);
      const newStatus = (res.data as { status: string }).status === "accepted" ? "friends" : "request_sent";
      setFriendStatus(newStatus as typeof friendStatus);
    } catch {
      // ignore
    } finally {
      setFriendLoading(false);
    }
  }, [profile]);

  const handleAccept = useCallback(async () => {
    if (!profile) return;
    setFriendLoading(true);
    try {
      await acceptFriendRequest(profile.id);
      setFriendStatus("friends");
    } catch {
      // ignore
    } finally {
      setFriendLoading(false);
    }
  }, [profile]);

  const handleDecline = useCallback(async () => {
    if (!profile) return;
    setFriendLoading(true);
    try {
      await declineFriendRequest(profile.id);
      setFriendStatus(null);
    } catch {
      // ignore
    } finally {
      setFriendLoading(false);
    }
  }, [profile]);

  const handleRemoveFriend = useCallback(async () => {
    if (!profile) return;
    setFriendLoading(true);
    try {
      await removeFriend(profile.id);
      setFriendStatus(null);
    } catch {
      // ignore
    } finally {
      setFriendLoading(false);
    }
  }, [profile]);

  const handleInvite = useCallback(async () => {
    if (!profile) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await inviteUserToGame(profile.id);
      navigate("/online-game", {
        state: { gameId: res.data.id, playerColor: "white", isPrivate: true },
      });
    } catch (e: unknown) {
      const status = (e as { response?: { status: number } }).response?.status;
      if (status === 400) {
        setInviteError("У тебя уже есть активная игра.");
      } else {
        setInviteError("Не удалось создать игру. Попробуй ещё раз.");
      }
    } finally {
      setInviteLoading(false);
    }
  }, [profile, navigate]);

  if (loading) return (
    <div className={styles.page}><div className={styles.loader}><div className={styles.spinner} /></div></div>
  );

  if (!profile) return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>← Назад</button>
      </div>
      <div className={styles.noUser}>Пользователь не найден</div>
    </div>
  );

  const winRate = profile.games_played > 0
    ? Math.round((profile.wins / profile.games_played) * 100) : null;

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Назад
        </button>
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.avatarWrap}>
          <AvatarWithFrame
            photoUrl={profile.photo_url}
            firstName={profile.first_name}
            lastName={profile.last_name}
            frame={profile.selected_frame ?? 0}
            size={80}
            className={styles.avatar}
            fallbackClassName={styles.avatarFallback}
          />
          <span className={`${styles.statusDot} ${profile.online ? styles.online : styles.offline}`} />
        </div>
        <h1 className={styles.name}>{profile.first_name} {profile.last_name ?? ""}</h1>
        {profile.username && <p className={styles.username}>@{profile.username}</p>}
        <div className={styles.ratingBadge}>
          <span className={styles.ratingIcon}><Crown size={14} /></span>
          <span className={styles.ratingValue}>{Math.round(profile.rating)}</span>
          <span className={styles.ratingLabel}>рейтинг</span>
        </div>

        {/* Friend buttons */}
        <div className={styles.heroActions}>
          {friendStatus === "friends" && (
            <button
              className={`${styles.friendBtn} ${styles.friendBtnRemove}`}
              onClick={handleRemoveFriend}
              disabled={friendLoading}
            >
              <UserMinus size={14} /> Удалить из друзей
            </button>
          )}
          {friendStatus === "request_sent" && (
            <button
              className={`${styles.friendBtn} ${styles.friendBtnPending}`}
              onClick={handleRemoveFriend}
              disabled={friendLoading}
            >
              <Clock size={14} /> Запрос отправлен
            </button>
          )}
          {friendStatus === "request_received" && (
            <>
              <button
                className={`${styles.friendBtn} ${styles.friendBtnAdd}`}
                onClick={handleAccept}
                disabled={friendLoading}
              >
                <Check size={14} /> Принять запрос
              </button>
              <button
                className={`${styles.friendBtn} ${styles.friendBtnRemove}`}
                onClick={handleDecline}
                disabled={friendLoading}
              >
                <X size={14} /> Отклонить
              </button>
            </>
          )}
          {!friendStatus && (
            <button
              className={`${styles.friendBtn} ${styles.friendBtnAdd}`}
              onClick={handleAddFriend}
              disabled={friendLoading}
            >
              <UserPlus size={14} /> Добавить в друзья
            </button>
          )}

          <button
            className={styles.inviteBtn}
            onClick={handleInvite}
            disabled={inviteLoading}
          >
            <Swords size={14} />
            {inviteLoading ? "Создание..." : "Пригласить играть"}
          </button>
        </div>
        {inviteError && <p className={styles.inviteError}>{inviteError}</p>}
      </div>

      {/* Stats */}
      <div className={styles.statsWrap}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statNum}>{profile.games_played}</span>
            <span className={styles.statName}>Игр</span>
          </div>
          <div className={`${styles.statCard} ${styles.win}`}>
            <span className={styles.statNum}>{profile.wins}</span>
            <span className={styles.statName}>Побед</span>
          </div>
          <div className={`${styles.statCard} ${styles.loss}`}>
            <span className={styles.statNum}>{profile.losses}</span>
            <span className={styles.statName}>Поражений</span>
          </div>
          <div className={`${styles.statCard} ${styles.draw}`}>
            <span className={styles.statNum}>{profile.draws}</span>
            <span className={styles.statName}>Ничьих</span>
          </div>
        </div>
        {winRate !== null && (
          <div className={styles.winRateBar}>
            <div className={styles.winRateLabels}>
              <span>Процент побед</span>
              <span className={styles.winRatePct}>{winRate}%</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${winRate}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Game history */}
      <div className={styles.listWrap}>
        <div className={styles.sectionTitle}>История партий</div>
        {gamesLoading ? (
          <div className={styles.skelList}>{[0,1,2,3].map(i => <div key={i} className={styles.skelRow} />)}</div>
        ) : !games?.length ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>♟</span>
            <p>Нет завершённых партий</p>
          </div>
        ) : (
          <div className={styles.gamesList}>
            {games.map((g: GameHistoryEntry) => {
              const resultClass = g.result === "win" ? styles.win : g.result === "loss" ? styles.loss : styles.draw;
              return (
                <div key={g.game_id} className={styles.gameRow}>
                  <div className={`${styles.resultBadge} ${resultClass}`}>
                    {g.result === "win" ? "W" : g.result === "loss" ? "L" : "D"}
                  </div>
                  <div className={styles.gameColor}>{g.player_color === "white" ? "♔" : "♟"}</div>
                  <div className={styles.gameInfo}>
                    <span className={styles.gameName}>{g.opponent_name ?? "Неизвестно"}</span>
                    <span className={styles.gameDate}>{formatDate(g.finished_at)}</span>
                  </div>
                  <div className={styles.gameActions}>
                    {g.game_type === "human" && g.opponent_id && (
                      <button className={styles.profileBtn} onClick={() => navigate(`/user/${g.opponent_id}`)}>
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
