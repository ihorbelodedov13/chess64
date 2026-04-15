import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "../components/Button";
import GameRoom from "../components/GameRoom";
import { GamesList } from "../components/GamesList";
import TimeControlPicker, { TIME_CONTROLS } from "../components/TimeControlPicker";
import type { TimeControl } from "../components/TimeControlPicker";
import {
  joinMatchmaking,
  joinGame,
  getActiveGame,
} from "../core/api";
import { getCachedInitData } from "../core/api";
import type { JoinGameResponse, MatchmakingJoinResponse, ActiveGameResponse } from "../types/api";
import type { PlayerColor } from "../stores/useChessStore";
import { Target, List, Crown } from "lucide-react";
import styles from "./OnlineGame.module.scss";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type OnlineGameMode = "menu" | "game" | "games-list";

interface ActiveGame {
  gameId: string;
  playerColor: PlayerColor;
}

const OnlineGame: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { gameId?: string; playerColor?: string; isPrivate?: boolean } | null;
  
  const [mode, setMode] = useState<OnlineGameMode>("menu");
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [isPrivateGame, setIsPrivateGame] = useState(false);
  const [restoredGame, setRestoredGame] = useState<ActiveGameResponse | null>(null);
  const [isCheckingActive, setIsCheckingActive] = useState(true);
  const [timeControl, setTimeControl] = useState<TimeControl>({ base: TIME_CONTROLS[4].base, increment: TIME_CONTROLS[4].increment }); // 5+0 по умолчанию
  
  // Loading states
  const [isFindingGame, setIsFindingGame] = useState(false);
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Start a game: switch to game view and clear any restored game
  const startGame = useCallback((gameId: string, playerColor: PlayerColor, privateGame = false) => {
    setActiveGame({ gameId, playerColor });
    setIsPrivateGame(privateGame);
    setRestoredGame(null);
    setMode("game");
  }, []);

  // Авто-вход в игру по router state (invite from friend profile)
  useEffect(() => {
    if (locationState?.gameId) {
      startGame(
        locationState.gameId,
        (locationState.playerColor as PlayerColor) ?? "white",
        locationState.isPrivate ?? false,
      );
      // Clear state so refresh doesn't re-enter
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Авто-join по invite link (game_id из sessionStorage)
  useEffect(() => {
    const inviteGameId = sessionStorage.getItem("invite_game_id");
    if (!inviteGameId) return;
    sessionStorage.removeItem("invite_game_id");

    joinGame(inviteGameId)
      .then((res) => {
        const data = res.data as JoinGameResponse;
        startGame(data.game_id, data.player_color as PlayerColor);
      })
      .catch(async (err) => {
        const status = (err as { response?: { status: number } }).response?.status;
        if (status === 400) {
          // уже в игре → открываем её
          await fetchActiveAndShow();
        } else if (status === 404) {
          setError("Игра не найдена или была отменена. Попробуйте попросить друга создать новую.");
        } else {
          setError("Не удалось присоединиться к игре по ссылке.");
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE connection for real-time active-game updates.
  // Opens when entering menu mode, closes when leaving.
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (mode !== "menu") {
      sseRef.current?.close();
      sseRef.current = null;
      return;
    }

    const token = getCachedInitData();
    if (!token) return;

    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const url = `${API_BASE_URL}/api/v1/game/active/stream?token=${encodeURIComponent(cleanToken)}`;
    const sse = new EventSource(url);
    sseRef.current = sse;

    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as { type: string; game: ActiveGameResponse | null };
        if (payload.type === "active_game") {
          setRestoredGame(payload.game);
          setIsCheckingActive(false);
        }
      } catch {
        // malformed event — ignore
      }
    };

    sse.onerror = () => {
      // Connection dropped; browser will auto-retry.
      // Fall back to a one-shot REST call so the banner shows immediately.
      getActiveGame()
        .then((res) => setRestoredGame(res.data ?? null))
        .catch(() => setRestoredGame(null))
        .finally(() => setIsCheckingActive(false));
    };

    return () => {
      sse.close();
      sseRef.current = null;
    };
  }, [mode]);

  // Handle matchmaking: join an existing waiting game or create a new one
  const handleFindGame = async () => {
    setIsFindingGame(true);
    setError(null);

    try {
      const response = await joinMatchmaking(timeControl);
      const result = response.data as MatchmakingJoinResponse;

      if (result.game_id) {
        startGame(result.game_id, (result.player_color as PlayerColor) ?? "white");
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number } };
      if (axiosErr.response?.status === 400) {
        await fetchActiveAndShow();
      } else {
        setError("Не удалось найти игру. Попробуйте ещё раз.");
      }
    } finally {
      setIsFindingGame(false);
    }
  };

  // Handle game joined from list
  const handleGameJoined = (gameId: string, playerColor: string) => {
    startGame(gameId, playerColor as PlayerColor);
  };

  // Handle back to menu
  const handleBackToMenu = useCallback(() => {
    setActiveGame(null);
    setMode("menu");
    setError(null);
  }, []);

  // Called when server says "you already have an active game" —
  // fetch it and open it immediately (or show the banner)
  const fetchActiveAndShow = useCallback(async () => {
    try {
      const res = await getActiveGame();
      if (res.data) {
        startGame(res.data.game_id, res.data.player_color);
      } else {
        setError("Не удалось найти активную игру. Попробуйте обновить страницу.");
      }
    } catch {
      setError("Не удалось загрузить активную игру.");
    }
  }, [startGame]);

  // Handle back to main
  const handleBack = () => {
    navigate("/");
  };

  // Render game room (active or restored after reload)
  if (mode === "game" && activeGame) {
    return (
      <GameRoom
        gameId={activeGame.gameId}
        playerColor={activeGame.playerColor}
        isPrivate={isPrivateGame}
        onLeave={handleBackToMenu}
      />
    );
  }

  // Render games list
  if (mode === "games-list") {
    return (
      <div className={styles.onlineGame}>
        <div className={`${styles.topBar} ${styles.wide}`}>
          <button className={styles.backBtn} onClick={handleBackToMenu}>← Назад в меню</button>
        </div>
        <div className={styles.gamesListContainer}>
          <h1 className={styles.onlineGameTitle}>Доступные игры</h1>
          <GamesList onGameJoined={handleGameJoined} />
        </div>
      </div>
    );
  }

  // Render menu
  return (
    <div className={styles.onlineGame}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={handleBack}>← Назад</button>
      </div>
      <div className={styles.onlineGameContainer}>
        <h1 className={styles.onlineGameTitle}>Игра по сети</h1>

        {/* Resume banner */}
        {!isCheckingActive && restoredGame && (
          <div className={styles.resumeBanner}>
            <div className={styles.resumeBannerText}>
              <span className={styles.resumeBannerIcon}><Crown size={20} /></span>
              <div>
                <strong>У вас есть незавершённая игра</strong>
                <span>
                  {restoredGame.game_type === "bot" ? "Партия с ботом" : "Онлайн-партия"} · игра #{restoredGame.game_id.slice(0, 8)}
                </span>
              </div>
            </div>
            <Button
              variant="primary"
              size="medium"
              onClick={() => startGame(restoredGame.game_id, restoredGame.player_color)}
              className={styles.resumeButton}
            >
              Вернуться в игру →
            </Button>
          </div>
        )}

        <div className={styles.onlineGameContent}>
          <div className={styles.timeControlSection}>
            <h3 className={styles.sectionLabel}>Контроль времени</h3>
            <TimeControlPicker value={timeControl} onChange={setTimeControl} />
          </div>

          <div className={styles.onlineGameButtons}>
            <Button
              variant="primary"
              size="large"
              onClick={handleFindGame}
              disabled={isFindingGame}
              className={styles.onlineGameButton}
            >
              {isFindingGame ? "Поиск..." : <><Target size={17} style={{ marginRight: 8 }} />Найти соперника</>}
            </Button>

            <Button
              variant="outline"
              size="large"
              onClick={() => setMode("games-list")}
              className={styles.onlineGameButton}
            >
              <List size={17} style={{ marginRight: 8 }} />Список игр
            </Button>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default OnlineGame;
