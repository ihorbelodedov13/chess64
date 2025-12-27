import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  TelegramUser,
  UserResponse,
  UserStats,
  GameResponse,
  JoinGameResponse,
  CreateBotGameRequest,
} from "../types/api";

// Базовая конфигурация API
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_KEY =
  import.meta.env.VITE_X_INIT_DATA_KEY ||
  "c7fdac45-3d59-4865-9671-f72c0fac468b";
const API_PREFIX = "/api/v1";

// Создание axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
});

// Хранилище для Telegram initData (для кеширования между запросами)
let cachedInitData: string | null = null;

/**
 * Установка кешированного Telegram initData
 * (опционально, если нужно сохранять initData между сессиями)
 */
export const setCachedInitData = (initData: string | null) => {
  cachedInitData = initData;
  if (initData) {
    localStorage.setItem("telegram_init_data", initData);
  } else {
    localStorage.removeItem("telegram_init_data");
  }
};

/**
 * Получение кешированного initData
 */
export const getCachedInitData = (): string | null => {
  if (!cachedInitData) {
    cachedInitData = localStorage.getItem("telegram_init_data");
  }
  return cachedInitData;
};

/**
 * Очистка кешированного initData
 */
export const clearCachedInitData = () => {
  cachedInitData = null;
  localStorage.removeItem("telegram_init_data");
};

// Обратная совместимость с существующим кодом
/**
 * @deprecated Используйте setCachedInitData вместо setAuthToken
 */
export const setAuthToken = setCachedInitData;

/**
 * @deprecated Используйте getCachedInitData вместо getAuthToken
 */
export const getAuthToken = getCachedInitData;

/**
 * @deprecated Используйте clearCachedInitData вместо clearAuthToken
 */
export const clearAuthToken = clearCachedInitData;

/**
 * Получение initData из Telegram WebApp
 */
const getTelegramInitData = (): string | null => {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp.initData || null;
  }
  return null;
};

// Request Interceptor - добавление Authorization заголовка с Telegram initData
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Получаем Telegram initData (сначала из WebApp, потом из кеша)
    const initData = getTelegramInitData() || getCachedInitData();
    if (initData) {
      // Авторизация через Telegram initData в заголовке Authorization
      config.headers.Authorization = initData;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor - обработка ошибок
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      // Обработка ошибок авторизации
      if (error.response.status === 401) {
        console.warn("Unauthorized: clearing cached initData");
        clearCachedInitData();
        // Можно добавить редирект на страницу авторизации
        // window.location.href = '/login';
      }

      // Обработка других ошибок
      if (error.response.status === 404) {
        console.warn("Resource not found:", error.config?.url);
      }

      if (error.response.status >= 500) {
        console.error("Server error:", error.response.data);
      }
    } else if (error.request) {
      console.error("Network error:", error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================
// AUTH ENDPOINTS
// ============================================

/**
 * Получение информации о пользователе из Telegram initData
 */
export const authUser = () => api.get<TelegramUser>(`${API_PREFIX}/auth/`);

/**
 * Получение полной информации о текущем пользователе
 */
export const fetchMe = () => api.get<UserResponse>(`${API_PREFIX}/auth/me`);

/**
 * Получение статистики пользователя по ID
 */
export const fetchUserStats = (userId: number) =>
  api.get<UserStats>(`${API_PREFIX}/auth/${userId}/stats`);

// ============================================
// GAME ENDPOINTS
// ============================================

/**
 * Получение списка доступных для присоединения игр
 */
export const getAvailableGames = () =>
  api.get<GameResponse[]>(`${API_PREFIX}/game/available`);

/**
 * Создание новой игры для присоединения других игроков
 */
export const createGame = () =>
  api.post<GameResponse>(`${API_PREFIX}/game/create`);

/**
 * Создание игры с ботом
 */
export const createBotGame = (data: CreateBotGameRequest) =>
  api.post<GameResponse>(`${API_PREFIX}/game/create/bot`, data);

/**
 * Присоединение к существующей игре
 */
export const joinGame = (gameId: number) =>
  api.post<JoinGameResponse>(`${API_PREFIX}/game/${gameId}/join`);

/**
 * Получение информации об игре
 */
export const getGameInfo = (gameId: number) =>
  api.get(`${API_PREFIX}/game/${gameId}`);

/**
 * Сдача в игре
 */
export const resignGame = (gameId: number) =>
  api.post(`${API_PREFIX}/game/${gameId}/resign`);

// ============================================
// MATCHMAKING ENDPOINTS
// ============================================

/**
 * Вход в очередь автоматического подбора соперника
 */
export const joinMatchmaking = () =>
  api.post(`${API_PREFIX}/game/matchmaking/join`);

/**
 * Выход из очереди матчмейкинга
 */
export const leaveMatchmaking = () =>
  api.post(`${API_PREFIX}/game/matchmaking/leave`);

/**
 * Получение статуса в очереди матчмейкинга
 */
export const getMatchmakingStatus = () =>
  api.get(`${API_PREFIX}/game/matchmaking/status`);

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Проверка здоровья сервера
 */
export const healthCheck = () => api.get("/health");

// Экспорт axios instance для продвинутого использования
export default api;
