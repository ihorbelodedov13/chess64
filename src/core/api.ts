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
  ActiveGameResponse,
  PublicUserResponse,
  GameHistoryEntry,
  FriendRequest,
} from "../types/api";

// Базовая конфигурация API
// Если VITE_API_BASE_URL не задан — используем относительные URL,
// чтобы запросы шли на тот же хост, с которого загружен фронтенд (nginx proxy).
// Это работает корректно как в Docker, так и через ngrok или любой другой домен.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const API_KEY = import.meta.env.VITE_X_INIT_DATA_KEY || "";
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
      // Формат: Bearer <telegram_init_data_token>
      const token = initData.startsWith("Bearer ") ? initData : `Bearer ${initData}`;
      config.headers.Authorization = token;
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
 * Получение активной игры текущего пользователя (для переподключения после перезагрузки)
 */
export const getActiveGame = () =>
  api.get<ActiveGameResponse | null>(`${API_PREFIX}/game/active`);

/**
 * Получение списка доступных для присоединения игр
 */
export const getAvailableGames = () =>
  api.get<GameResponse[]>(`${API_PREFIX}/game/available`);

/**
 * Создание новой игры для присоединения других игроков
 * @param isPrivate — если true, игра не видна в публичном списке (только по инвайт-ссылке)
 */
export const createGame = (isPrivate = false) =>
  api.post<GameResponse>(`${API_PREFIX}/game/create`, { is_private: isPrivate });

/**
 * Создание игры с ботом
 */
export const createBotGame = (data: CreateBotGameRequest) =>
  api.post<GameResponse>(`${API_PREFIX}/game/create/bot`, data);

/**
 * Отмена ожидающей игры (только создатель)
 */
export const cancelGame = (gameId: string) =>
  api.post(`${API_PREFIX}/game/${gameId}/cancel`);

/**
 * Присоединение к существующей игре
 */
export const joinGame = (gameId: string) =>
  api.post<JoinGameResponse>(`${API_PREFIX}/game/${gameId}/join`);

/**
 * Получение информации об игре
 */
export const getGameInfo = (gameId: string) =>
  api.get(`${API_PREFIX}/game/${gameId}`);

/**
 * Сдача в игре
 */
export const resignGame = (gameId: string) =>
  api.post(`${API_PREFIX}/game/${gameId}/resign`);

// ============================================
// MATCHMAKING ENDPOINTS
// ============================================

/**
 * Вход в очередь автоматического подбора соперника
 */
export const joinMatchmaking = (timeControl?: { base: number; increment: number }) =>
  api.post(`${API_PREFIX}/game/matchmaking/join`, timeControl ? { time_control: timeControl } : {});

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

// ============================================
// SOCIAL — FRIENDS & GAME HISTORY
// ============================================

export const fetchMyFriends = () =>
  api.get<PublicUserResponse[]>(`${API_PREFIX}/users/me/friends`);

export const fetchMyFriendRequests = () =>
  api.get<FriendRequest[]>(`${API_PREFIX}/users/me/friend-requests`);

export const fetchMyGames = (limit = 30, offset = 0) =>
  api.get<GameHistoryEntry[]>(`${API_PREFIX}/users/me/games`, { params: { limit, offset } });

export const fetchPublicProfile = (userId: number) =>
  api.get<PublicUserResponse>(`${API_PREFIX}/users/${userId}`);

export const fetchUserGames = (userId: number, limit = 30, offset = 0) =>
  api.get<GameHistoryEntry[]>(`${API_PREFIX}/users/${userId}/games`, { params: { limit, offset } });

export const sendFriendRequest = (userId: number) =>
  api.post(`${API_PREFIX}/users/${userId}/friend`);

export const acceptFriendRequest = (userId: number) =>
  api.post(`${API_PREFIX}/users/${userId}/friend/accept`);

export const declineFriendRequest = (userId: number) =>
  api.post(`${API_PREFIX}/users/${userId}/friend/decline`);

export const removeFriend = (userId: number) =>
  api.delete(`${API_PREFIX}/users/${userId}/friend`);

export const inviteUserToGame = (targetUserId: number) =>
  api.post<GameResponse>(`${API_PREFIX}/game/invite/${targetUserId}`);

export const updateFrame = (frame: number) =>
  api.patch<UserResponse>(`${API_PREFIX}/auth/me/frame`, { frame });

// Экспорт axios instance для продвинутого использования
export default api;
