import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import GameRoom from "../components/GameRoom";
import { GamesList } from "../components/GamesList";
import { useApi } from "../hooks/useApi";
import { createGame } from "../core/api";
import styles from "./OnlineGame.module.scss";

const OnlineGame: React.FC = () => {
  const navigate = useNavigate();
  const [currentGame, setCurrentGame] = useState<{
    type: "quick" | "rated" | "friend";
    gameId?: string;
  } | null>(null);
  const [friendGameId, setFriendGameId] = useState("");
  const [showGamesList, setShowGamesList] = useState(false);

  // API для создания игры
  const {
    loading: creatingGame,
    error: createGameError,
    execute: executeCreateGame,
  } = useApi(createGame);

  const handleBack = () => {
    navigate("/");
  };

  const handleRatedGame = () => {
    setCurrentGame({ type: "rated" });
  };

  const handleFriendGame = () => {
    if (friendGameId.trim()) {
      setCurrentGame({ type: "friend", gameId: friendGameId.trim() });
    }
  };

  const handleQuickGame = () => {
    setCurrentGame({ type: "quick" });
  };

  const handleBackToMenu = () => {
    setCurrentGame(null);
    setFriendGameId("");
    setShowGamesList(false);
  };

  const handleShowGamesList = () => {
    setShowGamesList(true);
  };

  const handleGameJoined = (gameId: number) => {
    // После успешного присоединения к игре, показываем игровую комнату
    setCurrentGame({ type: "friend", gameId: gameId.toString() });
    setShowGamesList(false);
  };

  const handleCreateGame = async () => {
    const newGame = await executeCreateGame();
    if (newGame) {
      // После создания игры, переходим к игровой комнате
      setCurrentGame({ type: "friend", gameId: newGame.id.toString() });
    }
  };

  if (currentGame) {
    return (
      <div className={styles.onlineGame}>
        <GameRoom gameType={currentGame.type} gameId={currentGame.gameId} />
        <Button
          variant="outline"
          size="medium"
          onClick={handleBackToMenu}
          className={styles.backButton}
        >
          ← Назад в меню
        </Button>
      </div>
    );
  }

  if (showGamesList) {
    return (
      <div className={styles.onlineGame}>
        <div className={styles.gamesListContainer}>
          <h1 className={styles.onlineGameTitle}>Доступные игры</h1>
          <GamesList onGameJoined={handleGameJoined} />
          <Button
            variant="outline"
            size="medium"
            onClick={handleBackToMenu}
            className={styles.backButton}
          >
            ← Назад в меню
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.onlineGame}>
      <div className={styles.onlineGameContainer}>
        <h1 className={styles.onlineGameTitle}>Игра по сети</h1>

        <div className={styles.onlineGameContent}>
          <div className={styles.onlineGameButtons}>
            <Button
              variant="primary"
              size="large"
              onClick={handleCreateGame}
              disabled={creatingGame}
              className={styles.onlineGameButton}
            >
              {creatingGame ? "Создание игры..." : "➕ Создать игру"}
            </Button>

            {createGameError && (
              <div className={styles.errorMessage}>
                Ошибка создания игры: {createGameError}
              </div>
            )}

            <Button
              variant="secondary"
              size="large"
              onClick={handleRatedGame}
              className={styles.onlineGameButton}
            >
              Игра по рейтингу
            </Button>

            <Button
              variant="secondary"
              size="large"
              onClick={handleQuickGame}
              className={styles.onlineGameButton}
            >
              Быстрая игра
            </Button>

            <Button
              variant="outline"
              size="large"
              onClick={handleShowGamesList}
              className={styles.onlineGameButton}
            >
              📋 Список игр
            </Button>

            <div className={styles.friendGameSection}>
              <h3>Игра с другом</h3>
              <div className={styles.friendGameInput}>
                <input
                  type="text"
                  placeholder="Введите ID игры"
                  value={friendGameId}
                  onChange={(e) => setFriendGameId(e.target.value)}
                  className={styles.gameIdInput}
                />
                <Button
                  variant="outline"
                  size="medium"
                  onClick={handleFriendGame}
                  disabled={!friendGameId.trim()}
                >
                  Присоединиться
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="medium"
          onClick={handleBack}
          className={styles.backButton}
        >
          ← Назад
        </Button>
      </div>
    </div>
  );
};

export default OnlineGame;
