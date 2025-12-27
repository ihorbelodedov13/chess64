/**
 * Пример компонента для создания игр
 * Демонстрирует использование API с React хуками
 */

import { useState } from "react";
import { useApi } from "../hooks/useApi";
import {
  createGame,
  createBotGame,
  joinMatchmaking,
  leaveMatchmaking,
} from "../core/api";
import type { BotDifficulty } from "../types/api";

export function GameCreator() {
  const [difficulty, setDifficulty] = useState<BotDifficulty>("medium");
  const [inQueue, setInQueue] = useState(false);

  // API hooks
  const {
    data: newGame,
    loading: creatingGame,
    execute: executeCreateGame,
  } = useApi(createGame);
  const {
    data: botGame,
    loading: creatingBotGame,
    execute: executeCreateBotGame,
  } = useApi(createBotGame);
  const { loading: joiningQueue, execute: executeJoinQueue } =
    useApi(joinMatchmaking);
  const { loading: leavingQueue, execute: executeLeaveQueue } =
    useApi(leaveMatchmaking);

  // Создание игры с другими игроками
  const handleCreateGame = async () => {
    const game = await executeCreateGame();
    if (game) {
      console.log("Игра создана:", game);
      // Переход к игре
      // navigate(`/game/${game.id}`);
    }
  };

  // Создание игры с ботом
  const handleCreateBotGame = async () => {
    const game = await executeCreateBotGame({
      difficulty,
      time_control: {
        base: 600,
        increment: 5,
      },
    });

    if (game) {
      console.log("Игра с ботом создана:", game);
      // Переход к игре
      // navigate(`/game/${game.id}`);
    }
  };

  // Вход в очередь матчмейкинга
  const handleJoinMatchmaking = async () => {
    const result = await executeJoinQueue();
    if (result) {
      setInQueue(true);
      console.log("Вошли в очередь");
    }
  };

  // Выход из очереди
  const handleLeaveMatchmaking = async () => {
    const result = await executeLeaveQueue();
    if (result) {
      setInQueue(false);
      console.log("Вышли из очереди");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Создание игры</h2>

      {/* Создание игры с игроками */}
      <section>
        <h3>Игра с другими игроками</h3>
        <button onClick={handleCreateGame} disabled={creatingGame}>
          {creatingGame ? "Создание..." : "Создать игру"}
        </button>
        {newGame && (
          <div>
            <p>Игра создана! ID: {newGame.id}</p>
            <p>Статус: {newGame.status}</p>
          </div>
        )}
      </section>

      {/* Создание игры с ботом */}
      <section style={{ marginTop: "20px" }}>
        <h3>Игра с ботом</h3>
        <div>
          <label>
            Сложность:
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as BotDifficulty)}
            >
              <option value="easy">Легко</option>
              <option value="medium">Средне</option>
              <option value="hard">Сложно</option>
            </select>
          </label>
        </div>
        <button onClick={handleCreateBotGame} disabled={creatingBotGame}>
          {creatingBotGame ? "Создание..." : "Создать игру с ботом"}
        </button>
        {botGame && (
          <div>
            <p>Игра с ботом создана! ID: {botGame.id}</p>
            <p>Статус: {botGame.status}</p>
          </div>
        )}
      </section>

      {/* Матчмейкинг */}
      <section style={{ marginTop: "20px" }}>
        <h3>Быстрая игра (матчмейкинг)</h3>
        {!inQueue ? (
          <button onClick={handleJoinMatchmaking} disabled={joiningQueue}>
            {joiningQueue ? "Вход в очередь..." : "Найти противника"}
          </button>
        ) : (
          <div>
            <p>В очереди поиска противника...</p>
            <button onClick={handleLeaveMatchmaking} disabled={leavingQueue}>
              {leavingQueue ? "Выход..." : "Отменить поиск"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
