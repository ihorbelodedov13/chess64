/**
 * Центральная точка экспорта для API модуля
 * Упрощает импорты в других частях приложения
 */

// API functions
export {
  // Auth
  authUser,
  fetchMe,
  fetchUserStats,

  // Games
  getAvailableGames,
  createGame,
  createBotGame,
  joinGame,
  getGameInfo,
  resignGame,
  getActiveGame,

  // Matchmaking
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,

  // Health
  healthCheck,

  // Token management (deprecated, используйте initData функции)
  setAuthToken,
  getAuthToken,
  clearAuthToken,

  // InitData management (рекомендуется)
  setCachedInitData,
  getCachedInitData,
  clearCachedInitData,
} from "./api";

// Initialization
export { initializeApp, loadUserData, isAuthenticated, logout } from "./init";

// Default export (axios instance)
export { default as api } from "./api";
