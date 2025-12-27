/**
 * Компонент списка доступных игр
 * Демонстрирует использование API для получения и присоединения к играм
 */

import { useEffect } from "react";
import { useApi } from "../hooks/useApi";
import { getAvailableGames, joinGame } from "../core/api";
import Button from "./Button";
import type { GameResponse } from "../types/api";
import styles from "./GamesList.module.scss";

interface GamesListProps {
  onGameJoined?: (gameId: number) => void;
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
  const handleJoinGame = async (gameId: number) => {
    const result = await executeJoinGame(gameId);
    if (result) {
      console.log("Присоединились к игре:", result);
      if (onGameJoined) {
        onGameJoined(result.game_id);
      }
    }
  };

  // Форматирование времени
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} мин`;
  };

  // Форматирование времени создания
  const formatCreatedAt = (dateString: string): string => {
    const date = new Date(dateString);
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
          {loadingGames ? "Обновление..." : "🔄 Обновить"}
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
            formatTime={formatTime}
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
  onJoin: (gameId: number) => void;
  joining: boolean;
  formatTime: (seconds: number) => string;
  formatCreatedAt: (dateString: string) => string;
}

function GameCard({
  game,
  onJoin,
  joining,
  formatTime,
  formatCreatedAt,
}: GameCardProps) {
  const isGameFull = game.white_player_id && game.black_player_id;

  return (
    <div className={`${styles.gameCard} ${isGameFull ? styles.gameFull : ""}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <h3 className={styles.gameTitle}>Игра #{game.id}</h3>
          <div className={styles.gameInfo}>
            <span>
              📊 Статус: <strong>{game.status}</strong>
            </span>
            <span>
              🎮 Тип: <strong>{game.game_type}</strong>
            </span>
            <span>
              ⏰ Создана: <strong>{formatCreatedAt(game.created_at)}</strong>
            </span>
          </div>
        </div>

        {!isGameFull && (
          <Button
            onClick={() => onJoin(game.id)}
            disabled={joining}
            variant="primary"
            size="medium"
          >
            {joining ? "Присоединение..." : "✓ Присоединиться"}
          </Button>
        )}
      </div>

      <div className={styles.cardDetails}>
        <div>
          ⚪ Белые:{" "}
          {game.white_player_id
            ? `Игрок #${game.white_player_id}`
            : "Ожидание..."}
        </div>
        <div>
          ⚫ Черные:{" "}
          {game.black_player_id
            ? `Игрок #${game.black_player_id}`
            : "Ожидание..."}
        </div>
        <div>
          ⏱️ Контроль времени: {formatTime(game.time_control.base)} +{" "}
          {game.time_control.increment}с
        </div>
      </div>

      {isGameFull && <div className={styles.fullBadge}>Игра заполнена</div>}
    </div>
  );
}
