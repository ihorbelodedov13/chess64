import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";
import { useApi } from "../hooks/useApi";
import {
  fetchUserStats,
  fetchMyFriends,
  fetchMyFriendRequests,
  fetchMyGames,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "../core/api";
import type { PublicUserResponse, GameHistoryEntry, FriendRequest } from "../types/api";
import { Crown, UserMinus, ChevronRight, Check, X, ShoppingBag } from "lucide-react";
import AvatarWithFrame from "../components/AvatarWithFrame";
import styles from "./Profile.module.scss";

type Tab = "overview" | "friends" | "history";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} д. назад`;
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, isLoading } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: stats, loading: statsLoading, execute: loadStats } = useApi(fetchUserStats);
  const { data: friends, loading: friendsLoading, execute: loadFriends } = useApi(fetchMyFriends);
  const { data: games, loading: gamesLoading, execute: loadGames } = useApi(fetchMyGames);

  const [requests, setRequests] = useState<FriendRequest[] | null>(null);
  const [requestsLoading, setRequestsLoading] = useState(false);

  useEffect(() => {
    if (user?.id) loadStats(user.id);
  }, [user?.id, loadStats]);

  useEffect(() => {
    if (activeTab === "friends") {
      // Always refresh requests and friends on tab open
      loadFriends();
      setRequestsLoading(true);
      fetchMyFriendRequests()
        .then(r => {
          setRequests(r.data);
          setRequestsCount(r.data.length);
        })
        .catch(() => setRequests([]))
        .finally(() => setRequestsLoading(false));
    }
    if (activeTab === "history" && !games) loadGames();
  }, [activeTab]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Badge count: load once on mount and subscribe to global friend_request events
  const [requestsCount, setRequestsCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    fetchMyFriendRequests()
      .then(r => setRequestsCount(r.data.length))
      .catch(() => {});
  }, [user?.id]);

  // Listen for real-time friend request events to update badge
  useEffect(() => {
    const handler = () => {
      fetchMyFriendRequests()
        .then(r => setRequestsCount(r.data.length))
        .catch(() => {});
    };
    window.addEventListener("friend_request_received", handler);
    return () => window.removeEventListener("friend_request_received", handler);
  }, []);

  const handleAccept = useCallback(async (fromUserId: number) => {
    await acceptFriendRequest(fromUserId);
    setRequests(r => r ? r.filter(req => req.from_user_id !== fromUserId) : r);
    setRequestsCount(c => Math.max(0, c - 1));
    loadFriends();
  }, [loadFriends]);

  const handleDecline = useCallback(async (fromUserId: number) => {
    await declineFriendRequest(fromUserId);
    setRequests(r => r ? r.filter(req => req.from_user_id !== fromUserId) : r);
    setRequestsCount(c => Math.max(0, c - 1));
  }, []);

  const handleRemoveFriend = useCallback(async (targetId: number) => {
    await removeFriend(targetId);
    loadFriends();
  }, [loadFriends]);

  const displayUser = stats ?? user;
  const winRate = displayUser && displayUser.games_played > 0
    ? Math.round((displayUser.wins / displayUser.games_played) * 100) : null;

  if (isLoading) return (
    <div className={styles.page}><div className={styles.loader}><div className={styles.spinner} /></div></div>
  );
  if (!user) return (
    <div className={styles.page}><div className={styles.noUser}>Пользователь не авторизован</div></div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/" className={styles.backBtn}>← Назад</Link>
        <button className={styles.shopBtn} onClick={() => navigate("/shop")}>
          <ShoppingBag size={16} />
          Магазин
        </button>
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.avatarWrap}>
          <AvatarWithFrame
            photoUrl={displayUser?.photo_url}
            firstName={user.first_name}
            lastName={user.last_name}
            frame={user.selected_frame ?? 0}
            size={80}
            className={styles.avatar}
            fallbackClassName={styles.avatarFallback}
          />
          {stats && (
            <span className={`${styles.statusDot} ${stats.online ? styles.online : styles.offline}`} />
          )}
        </div>
        <h1 className={styles.name}>{user.first_name} {user.last_name ?? ""}</h1>
        {user.username && <p className={styles.username}>@{user.username}</p>}
        <div className={styles.ratingBadge}>
          <span className={styles.ratingIcon}><Crown size={14} /></span>
          <span className={styles.ratingValue}>{Math.round(user.rating)}</span>
          <span className={styles.ratingLabel}>рейтинг</span>
        </div>
        {stats && !stats.online && (
          <p className={styles.lastSeen}>Был(а) {formatDate(stats.last_online)}</p>
        )}
        {stats?.online && <p className={styles.lastSeen} style={{ color: "#4ade80" }}>В сети</p>}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "overview" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("overview")}
        >Обзор</button>
        <button
          className={`${styles.tab} ${activeTab === "friends" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          Друзья
          {requestsCount > 0 && <span className={styles.tabBadge}>{requestsCount}</span>}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "history" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("history")}
        >История</button>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className={styles.statsWrap}>
            {statsLoading ? (
              <div className={styles.statsPlaceholder}>
                {[0,1,2,3].map(i => <div key={i} className={styles.skelCard} />)}
              </div>
            ) : displayUser ? (
              <>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{displayUser.games_played}</span>
                    <span className={styles.statName}>Игр</span>
                  </div>
                  <div className={`${styles.statCard} ${styles.win}`}>
                    <span className={styles.statNum}>{displayUser.wins}</span>
                    <span className={styles.statName}>Побед</span>
                  </div>
                  <div className={`${styles.statCard} ${styles.loss}`}>
                    <span className={styles.statNum}>{displayUser.losses}</span>
                    <span className={styles.statName}>Поражений</span>
                  </div>
                  <div className={`${styles.statCard} ${styles.draw}`}>
                    <span className={styles.statNum}>{displayUser.draws}</span>
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
              </>
            ) : null}
          </div>
        )}

        {/* FRIENDS */}
        {activeTab === "friends" && (
          <div className={styles.listWrap}>

            {/* Incoming requests */}
            <div className={styles.requestsSection}>
              <div className={styles.sectionTitle}>Запросы в друзья</div>
              {requestsLoading ? (
                <div className={styles.skelList}>{[0,1].map(i => <div key={i} className={styles.skelRow} />)}</div>
              ) : !requests?.length ? (
                <div className={styles.emptyStateSmall}>Нет входящих запросов</div>
              ) : (
                <div className={styles.friendsList}>
                  {requests.map(req => (
                    <div key={req.id} className={styles.friendRow}>
                      <div className={styles.friendAvatar}>
                        <AvatarWithFrame
                          photoUrl={req.photo_url}
                          firstName={req.first_name}
                          lastName={req.last_name}
                          frame={req.selected_frame ?? 0}
                          size={40}
                        />
                        <span className={`${styles.onlineDot} ${req.online ? styles.dotOnline : styles.dotOffline}`} />
                      </div>
                      <div className={styles.friendInfo} onClick={() => navigate(`/user/${req.from_user_id}`)}>
                        <span className={styles.friendName}>{req.first_name} {req.last_name ?? ""}</span>
                        {req.username && <span className={styles.friendUsername}>@{req.username}</span>}
                        <span className={styles.friendRating}><Crown size={10} /> {Math.round(req.rating)}</span>
                      </div>
                      <div className={styles.friendActions}>
                        <button
                          className={`${styles.friendToggle} ${styles.friendToggleAdd}`}
                          onClick={() => handleAccept(req.from_user_id)}
                          title="Принять"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className={`${styles.friendToggle} ${styles.friendToggleRemove}`}
                          onClick={() => handleDecline(req.from_user_id)}
                          title="Отклонить"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Friends list */}
            <div className={styles.sectionTitle}>Мои друзья</div>
            {friendsLoading ? (
              <div className={styles.skelList}>{[0,1,2].map(i => <div key={i} className={styles.skelRow} />)}</div>
            ) : !friends?.length ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>👥</span>
                <p>Список друзей пуст</p>
                <span className={styles.emptyHint}>Добавляй друзей из истории партий</span>
              </div>
            ) : (
              <div className={styles.friendsList}>
                {friends.map((f: PublicUserResponse) => (
                  <div key={f.id} className={styles.friendRow}>
                    <div className={styles.friendAvatar}>
                      <AvatarWithFrame
                        photoUrl={f.photo_url}
                        firstName={f.first_name}
                        lastName={f.last_name}
                        frame={f.selected_frame ?? 0}
                        size={40}
                      />
                      <span className={`${styles.onlineDot} ${f.online ? styles.dotOnline : styles.dotOffline}`} />
                    </div>
                    <div className={styles.friendInfo} onClick={() => navigate(`/user/${f.id}`)}>
                      <span className={styles.friendName}>{f.first_name} {f.last_name ?? ""}</span>
                      {f.username && <span className={styles.friendUsername}>@{f.username}</span>}
                      <span className={styles.friendRating}><Crown size={10} /> {Math.round(f.rating)}</span>
                    </div>
                    <div className={styles.friendActions}>
                      <button className={styles.profileBtn} onClick={() => navigate(`/user/${f.id}`)}>
                        <ChevronRight size={16} />
                      </button>
                      <button
                        className={`${styles.friendToggle} ${styles.friendToggleRemove}`}
                        onClick={() => handleRemoveFriend(f.id)}
                        title="Удалить из друзей"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {activeTab === "history" && (
          <div className={styles.listWrap}>
            {gamesLoading ? (
              <div className={styles.skelList}>{[0,1,2,3].map(i => <div key={i} className={styles.skelRow} />)}</div>
            ) : !games?.length ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>♟</span>
                <p>Нет завершённых партий</p>
              </div>
            ) : (
              <div className={styles.gamesList}>
                {games.map((g: GameHistoryEntry) => (
                  <GameRow key={g.game_id} game={g} onViewProfile={(id) => navigate(`/user/${id}`)} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function GameRow({
  game,
  onViewProfile,
}: {
  game: GameHistoryEntry;
  onViewProfile: (id: number) => void;
}) {
  const resultClass = game.result === "win" ? styles.win : game.result === "loss" ? styles.loss : styles.draw;

  return (
    <div className={styles.gameRow}>
      <div className={`${styles.resultBadge} ${resultClass}`}>
        {game.result === "win" ? "W" : game.result === "loss" ? "L" : "D"}
      </div>
      <div className={styles.gameColor}>{game.player_color === "white" ? "♔" : "♟"}</div>
      <div className={styles.gameInfo}>
        <span className={styles.gameName}>{game.opponent_name ?? "Неизвестно"}</span>
        <span className={styles.gameDate}>{
          game.finished_at
            ? new Date(game.finished_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
            : "—"
        }</span>
      </div>
      <div className={styles.gameActions}>
        {game.game_type === "human" && game.opponent_id && (
          <button className={styles.profileBtn} onClick={() => onViewProfile(game.opponent_id!)}>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
