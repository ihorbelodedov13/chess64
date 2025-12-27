/**
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ API
 *
 * Этот файл содержит примеры использования API функций.
 * НЕ импортируйте этот файл в продакшн код!
 */

/* eslint-disable */
// @ts-nocheck

import {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  authUser,
  fetchMe,
  fetchUserStats,
  getAvailableGames,
  createGame,
  createBotGame,
  joinGame,
  getGameInfo,
  resignGame,
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,
  healthCheck,
} from "./api";
import { useApi } from "../hooks/useApi";

// ============================================
// 1. БАЗОВОЕ ИСПОЛЬЗОВАНИЕ API
// ============================================

async function example1_BasicAuth() {
  try {
    // Авторизация через Telegram
    const { data: user } = await authUser();
    console.log("Пользователь:", user);

    // Получение полной информации о себе
    const { data: me } = await fetchMe();
    console.log("Моя информация:", me);

    // Получение статистики другого пользователя
    const { data: stats } = await fetchUserStats(123);
    console.log("Статистика пользователя:", stats);
  } catch (error) {
    console.error("Ошибка:", error);
  }
}

// ============================================
// 2. РАБОТА С ТОКЕНОМ
// ============================================

async function example2_TokenManagement() {
  // Установка токена (например, полученного от сервера)
  setAuthToken("your-jwt-token-here");

  // Все последующие запросы будут автоматически включать токен
  const { data } = await fetchMe();

  // Получение текущего токена
  const token = getAuthToken();
  console.log("Текущий токен:", token);

  // Очистка токена (при выходе)
  clearAuthToken();
}

// ============================================
// 3. СОЗДАНИЕ И ПРИСОЕДИНЕНИЕ К ИГРАМ
// ============================================

async function example3_GameCreation() {
  try {
    // Получить список доступных игр
    const { data: games } = await getAvailableGames();
    console.log("Доступные игры:", games);

    // Создать новую игру для игры с другими игроками
    const { data: newGame } = await createGame();
    console.log("Создана игра:", newGame);

    // Создать игру с ботом
    const { data: botGame } = await createBotGame({
      difficulty: "medium",
      time_control: {
        base: 600,
        increment: 10,
      },
    });
    console.log("Игра с ботом:", botGame);

    // Присоединиться к существующей игре
    const { data: joinResult } = await joinGame(newGame.id);
    console.log("Присоединились к игре:", joinResult);

    // Получить информацию об игре
    const { data: gameInfo } = await getGameInfo(newGame.id);
    console.log("Информация об игре:", gameInfo);
  } catch (error) {
    console.error("Ошибка при работе с играми:", error);
  }
}

// ============================================
// 4. МАТЧМЕЙКИНГ
// ============================================

async function example4_Matchmaking() {
  try {
    // Войти в очередь матчмейкинга
    await joinMatchmaking();
    console.log("Вошли в очередь");

    // Проверить статус в очереди
    const { data: status } = await getMatchmakingStatus();
    console.log("Статус матчмейкинга:", status);

    // Выйти из очереди
    await leaveMatchmaking();
    console.log("Вышли из очереди");
  } catch (error) {
    console.error("Ошибка матчмейкинга:", error);
  }
}

// ============================================
// 5. ИСПОЛЬЗОВАНИЕ С REACT ХУКАМИ
// ============================================

function Example5_ReactComponent() {
  // Простое использование с ручным вызовом
  const { data: user, loading, error, execute } = useApi(fetchMe);

  const loadUser = async () => {
    await execute();
  };

  // Использование для создания игры
  const {
    data: game,
    loading: creatingGame,
    execute: createNewGame,
  } = useApi(createGame);

  const handleCreateGame = async () => {
    const newGame = await createNewGame();
    if (newGame) {
      console.log("Игра создана:", newGame);
    }
  };

  // Использование для создания игры с ботом
  const {
    data: botGame,
    loading: creatingBotGame,
    execute: createNewBotGame,
  } = useApi(createBotGame);

  const handleCreateBotGame = async () => {
    const newBotGame = await createNewBotGame({
      difficulty: "hard",
      time_control: { base: 300, increment: 5 },
    });
    if (newBotGame) {
      console.log("Игра с ботом создана:", newBotGame);
    }
  };

  return null;
}

// ============================================
// 6. ОБРАБОТКА ОШИБОК
// ============================================

async function example6_ErrorHandling() {
  try {
    const { data } = await fetchMe();
    console.log("Успех:", data);
  } catch (error) {
    // Ошибка автоматически логируется interceptor'ом
    // Здесь можно добавить дополнительную обработку
    console.error("Произошла ошибка:", error);
  }
}

// ============================================
// 7. ПРОВЕРКА ЗДОРОВЬЯ СЕРВЕРА
// ============================================

async function example7_HealthCheck() {
  try {
    const { data } = await healthCheck();
    console.log("Сервер работает:", data);
  } catch (error) {
    console.error("Сервер недоступен:", error);
  }
}

// ============================================
// 8. ИСПОЛЬЗОВАНИЕ В ZUSTAND STORE
// ============================================

import { create } from "zustand";
import type { UserResponse } from "../types/api";

interface UserStore {
  user: UserResponse | null;
  loading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  logout: () => void;
}

const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: false,
  error: null,

  fetchUser: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await fetchMe();
      set({ user: data, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unknown error",
        loading: false,
      });
    }
  },

  logout: () => {
    clearAuthToken();
    set({ user: null });
  },
}));

// ============================================
// 9. ПОЛНЫЙ ПРИМЕР ИГРОВОГО ФЛОУ
// ============================================

async function example9_FullGameFlow() {
  try {
    // 1. Авторизация
    const { data: user } = await authUser();
    console.log("Авторизован:", user);

    // 2. Загрузка информации о пользователе
    const { data: me } = await fetchMe();
    console.log("Мой профиль:", me);

    // 3. Вход в матчмейкинг
    await joinMatchmaking();
    console.log("В очереди матчмейкинга...");

    // 4. Периодическая проверка статуса
    const checkStatus = setInterval(async () => {
      const { data: status } = await getMatchmakingStatus();
      console.log("Статус:", status);

      // Если игра найдена, выходим из проверки
      // (логика зависит от структуры ответа API)
    }, 2000);

    // 5. Когда игра найдена (предположим gameId = 123)
    clearInterval(checkStatus);
    const gameId = 123;

    // 6. Получаем информацию об игре
    const { data: gameInfo } = await getGameInfo(gameId);
    console.log("Информация об игре:", gameInfo);

    // 7. Играем... (через WebSocket)
    // ...

    // 8. Если нужно сдаться
    // await resignGame(gameId);
  } catch (error) {
    console.error("Ошибка в игровом флоу:", error);
  }
}

export {};
