import { authUser, fetchMe, setAuthToken, getAuthToken } from "./api";
import { useAppStore } from "../stores/useAppStore";

/**
 * Инициализация приложения
 * - Проверяет наличие сохраненного токена
 * - Авторизует пользователя через Telegram
 * - Загружает данные пользователя
 */
export async function initializeApp(): Promise<boolean> {
  const { setUser, setLoading } = useAppStore.getState();

  setLoading(true);

  try {
    // Проверяем наличие сохраненного токена
    const existingToken = getAuthToken();

    if (existingToken) {
      // Если токен есть, загружаем данные пользователя
      try {
        const { data } = await fetchMe();
        setUser(data);
        setLoading(false);
        return true;
      } catch (error) {
        console.warn("Saved token is invalid, trying to re-authenticate");
        // Токен невалидный, пробуем авторизоваться заново
      }
    }

    // Авторизация через Telegram
    try {
      const { data: telegramUser } = await authUser();
      console.log("Telegram auth successful:", telegramUser);

      // После успешной авторизации через Telegram,
      // загружаем полные данные пользователя
      const { data: fullUser } = await fetchMe();
      setUser(fullUser);

      // Если сервер вернул токен в заголовках или теле ответа,
      // сохраняем его (зависит от реализации сервера)
      // setAuthToken(response.headers['authorization']);

      setLoading(false);
      return true;
    } catch (error) {
      console.error("Failed to authenticate via Telegram:", error);
      setLoading(false);
      return false;
    }
  } catch (error) {
    console.error("Failed to initialize app:", error);
    setLoading(false);
    return false;
  }
}

/**
 * Загрузка данных пользователя
 */
export async function loadUserData(): Promise<void> {
  const { setUser, setLoading } = useAppStore.getState();

  setLoading(true);

  try {
    const { data } = await fetchMe();
    setUser(data);
  } catch (error) {
    console.error("Failed to load user data:", error);
  } finally {
    setLoading(false);
  }
}

/**
 * Проверка авторизации
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  const user = useAppStore.getState().user;
  return !!token || !!user;
}

/**
 * Выход из системы
 */
export function logout(): void {
  const { setUser } = useAppStore.getState();
  setAuthToken(null);
  setUser(null);
}
