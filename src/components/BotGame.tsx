import React, { useState, useCallback } from "react";
import GameRoom from "./GameRoom";
import Button from "./Button";
import TimeControlPicker, { TIME_CONTROLS } from "./TimeControlPicker";
import type { TimeControl } from "./TimeControlPicker";
import { createBotGame } from "../core/api";
import type { BotDifficulty, GameResponse } from "../types/api";
import { Play } from "lucide-react";
import styles from "./BotGame.module.scss";

interface BotGameProps {
  onBackToMenu: () => void;
}

const BotGame: React.FC<BotGameProps> = ({ onBackToMenu }) => {
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [timeControl, setTimeControl] = useState<TimeControl>({ base: TIME_CONTROLS[4].base, increment: TIME_CONTROLS[4].increment }); // 5+0 по умолчанию
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentGame, setCurrentGame] = useState<GameResponse | null>(null);

  const handleCreateGame = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await createBotGame({ difficulty, time_control: timeControl });
      setCurrentGame(response.data);
    } catch (err) {
      console.error("Failed to create bot game:", err);
      setError("Не удалось создать игру с ботом. Попробуйте ещё раз.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLeaveGame = useCallback(() => {
    setCurrentGame(null);
  }, []);

  // If game is active, show GameRoom
  if (currentGame) {
    return (
      <GameRoom
        gameId={currentGame.id}
        playerColor="white"
        isBot={true}
        onLeave={handleLeaveGame}
      />
    );
  }

  // Difficulty selection screen
  return (
    <div className={styles.botGame}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBackToMenu}>← Назад</button>
      </div>
      <div className={styles.container}>
        <h1 className={styles.title}>Игра с ботом</h1>
        <p className={styles.description}>
          Выберите уровень сложности бота и начните игру. Вы будете играть белыми.
        </p>

        <div className={styles.difficultySelector}>
          <h3>Уровень сложности:</h3>
          <div className={styles.difficultyButtons}>
            <button
              className={`${styles.difficultyBtn} ${difficulty === "easy" ? styles.active : ""}`}
              onClick={() => setDifficulty("easy")}
            >
              <span className={`${styles.difficultyIcon} ${styles.iconEasy}`} />
              <span className={styles.difficultyName}>Легкий</span>
              <span className={styles.difficultyDesc}>Для начинающих</span>
            </button>

            <button
              className={`${styles.difficultyBtn} ${difficulty === "medium" ? styles.active : ""}`}
              onClick={() => setDifficulty("medium")}
            >
              <span className={`${styles.difficultyIcon} ${styles.iconMedium}`} />
              <span className={styles.difficultyName}>Средний</span>
              <span className={styles.difficultyDesc}>Для любителей</span>
            </button>

            <button
              className={`${styles.difficultyBtn} ${difficulty === "hard" ? styles.active : ""}`}
              onClick={() => setDifficulty("hard")}
            >
              <span className={`${styles.difficultyIcon} ${styles.iconHard}`} />
              <span className={styles.difficultyName}>Сложный</span>
              <span className={styles.difficultyDesc}>Для опытных</span>
            </button>
          </div>
        </div>

        <div className={styles.difficultySelector}>
          <h3>Контроль времени:</h3>
          <TimeControlPicker value={timeControl} onChange={setTimeControl} />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="large"
            onClick={handleCreateGame}
            disabled={isCreating}
          >
            {isCreating ? "Создание игры..." : <><Play size={16} style={{ marginRight: 8 }} />Начать игру</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BotGame;
