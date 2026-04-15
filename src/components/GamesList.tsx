/**
 * Компонент списка доступных игр
 * Демонстрирует использование API для получения и присоединения к играм
 */

import { useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { getAvailableGames, joinGame } from "../core/api";
import Button from "./Button";
import { TIME_CONTROLS } from "./TimeControlPicker";
import type { GameResponse, JoinGameResponse } from "../types/api";
import { RefreshCw, Check, Circle, Timer } from "lucide-react";
import styles from "./GamesList.module.scss";

interface GamesListProps {
  onGameJoined?: (gameId: string, playerColor: string) => void;
}

/** Возвращает строку вида "5+0 · Блиц" или "10+5 · Рапид" */
function formatTimeControl(base: number, increment: number): { label: string; category: string } {
  const found = TIME_CONTROLS.find((t) => t.base === base && t.increment === increment);
  if (found) return { label: found.label, category: found.category };
  const mins = base / 60;
  return {
    label: `${Number.isInteger(mins) ? mins : base}+${increment}`,
    category: "",
  };
}

interface GamesListProps {
  onGameJoined?: (gameId: string, playerColor: string) => void;
}

export function GamesList({ onGameJoined }: GamesListProps) {
  const {
    data: games,
    loading: loadingGames,
    error: gamesError,
    execute: loadGames,
  } = useApi(getAvailableGames);

  const {
    loading: joiningGame,
    error: joinError,
    execute: executeJoinGame,
  } = useApi(joinGame);

  // Загрузка игр при монтировании
  useEffect(() => {
    loadGames();
    // Обновление списка каждые 5 секунд
    const interval = setInterval(() => {
      loadGames();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadGames]);

  // Присоединение к игре
  const handleJoinGame = async (gameId: string) => {
    const result = await executeJoinGame(gameId) as JoinGameResponse | null;
    if (result) {
      console.log("Присоединились к игре:", result);
      if (onGameJoined) {
        onGameJoined(result.game_id, result.player_color);
      }
    }
  };

  // Форматирование времени создания
  const formatCreatedAt = (dateString: string): string => {
    // Сервер отдаёт время в UTC без суффикса — добавляем Z чтобы Date правильно его парсил
    const normalized = dateString.endsWith("Z") ? dateString : dateString + "Z";
    const date = new Date(normalized);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "только что";
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return date.toLocaleDateString("ru-RU");
  };

  if (loadingGames && !games) {
    return <div className={styles.loadingState}>Загрузка игр...</div>;
  }

  if (gamesError) {
    return (
      <div className={styles.gamesListContainer}>
        <div className={styles.errorMessage}>
          Ошибка загрузки игр: {gamesError}
        </div>
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>Нет доступных игр</h3>
        <p>Создайте новую игру, чтобы начать играть!</p>
      </div>
    );
  }

  return (
    <div className={styles.gamesListContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Доступные игры ({games.length})</h2>
        <Button
          onClick={() => loadGames()}
          disabled={loadingGames}
          variant="outline"
          size="small"
        >
          {loadingGames ? "Обновление..." : <><RefreshCw size={13} style={{ marginRight: 5 }} />Обновить</>}
        </Button>
      </div>

      {joinError && (
        <div className={styles.errorMessage}>
          Ошибка присоединения: {joinError}
        </div>
      )}

      <div className={styles.gamesGrid}>
        {games.map((game: GameResponse) => (
          <GameCard
            key={game.id}
            game={game}
            onJoin={handleJoinGame}
            joining={joiningGame}
            formatCreatedAt={formatCreatedAt}
          />
        ))}
      </div>
    </div>
  );
}

// Отдельный компонент для карточки игры
interface GameCardProps {
  game: GameResponse;
  onJoin: (gameId: string) => void;
  joining: boolean;
  formatCreatedAt: (dateString: string) => string;
}

function GameCard({ game, onJoin, joining, formatCreatedAt }: GameCardProps) {
  const isGameFull = game.white_player_id && game.black_player_id;
  const tc = formatTimeControl(game.time_control.base, game.time_control.increment);

  return (
    <div className={`${styles.gameCard} ${isGameFull ? styles.gameFull : ""}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardLeft}>
          <div className={styles.tcBadge}>
            <Timer size={12} />
            <span className={styles.tcLabel}>{tc.label}</span>
            {tc.category && <span className={styles.tcCategory}>{tc.category}</span>}
          </div>
          <span className={styles.cardAge}>{formatCreatedAt(game.created_at)}</span>
        </div>

        {!isGameFull && (
          <Button onClick={() => onJoin(game.id)} disabled={joining} variant="primary" size="small">
            {joining ? "..." : <><Check size={13} style={{ marginRight: 4 }} />Войти</>}
          </Button>
        )}
      </div>

      <div className={styles.cardPlayers}>
        <div className={styles.playerSlot}>
          <Circle size={8} fill="white" />
          <span>{game.white_player_id ? "Игрок" : <span className={styles.waiting}>Ждёт...</span>}</span>
        </div>
        <span className={styles.vs}>vs</span>
        <div className={styles.playerSlot}>
          <Circle size={8} fill="currentColor" style={{ opacity: 0.45 }} />
          <span>{game.black_player_id ? "Игрок" : <span className={styles.waiting}>Ждёт...</span>}</span>
        </div>
      </div>

      {isGameFull && <div className={styles.fullBadge}>Игра заполнена</div>}
    </div>
  );
}
