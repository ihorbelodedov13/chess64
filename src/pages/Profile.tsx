import { useAppStore } from "../stores/useAppStore";
import { UserProfile } from "../components/UserProfile";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { fetchUserStats } from "../core/api";
import { useEffect } from "react";
import styles from "./Profile.module.scss";

/**
 * Страница профиля пользователя
 * Отображает информацию, полученную при инициализации приложения
 * и дополнительную статистику из API
 */
export default function Profile() {
  const { user, isLoading } = useAppStore();
  const {
    data: userStats,
    loading: statsLoading,
    error: statsError,
    execute: loadStats,
  } = useApi(fetchUserStats);

  // Загружаем статистику когда пользователь доступен
  useEffect(() => {
    if (user?.id) {
      loadStats(user.id);
    }
  }, [user?.id, loadStats]);

  if (isLoading) {
    return (
      <div className={styles.profile}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div className={styles.profile}>
      <div className={styles.header}>
        <Link to="/" className={styles.backButton}>
          ← Назад на главную
        </Link>
        <h1>Профиль пользователя</h1>
      </div>

      <div className={styles.content}>
        {user ? (
          <>
            <UserProfile />

            {/* Статистика пользователя из API */}
            <div className={styles.statsSection}>
              <h3>Статистика игрока</h3>
              {statsLoading && (
                <div className={styles.statsLoading}>
                  Загрузка статистики...
                </div>
              )}
              {statsError && (
                <div className={styles.statsError}>
                  Ошибка загрузки статистики: {statsError}
                </div>
              )}
              {userStats && (
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Рейтинг</div>
                    <div className={styles.statValue}>{userStats.rating}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Игр сыграно</div>
                    <div className={styles.statValue}>
                      {userStats.games_played}
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Статус</div>
                    <div className={styles.statValue}>
                      {userStats.online ? (
                        <span className={styles.online}>🟢 Онлайн</span>
                      ) : (
                        <span className={styles.offline}>⚪ Не в сети</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statLabel}>Последняя активность</div>
                    <div className={styles.statValue}>
                      {new Date(userStats.last_online).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Дополнительная информация из инициализации */}
            <div className={styles.additionalInfo}>
              <h3>Информация о сессии</h3>
              <div className={styles.infoItem}>
                <strong>ID пользователя:</strong> {user.id}
              </div>
              <div className={styles.infoItem}>
                <strong>Дата регистрации:</strong>{" "}
                {new Date(user.created_at).toLocaleDateString("ru-RU", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className={styles.infoItem}>
                <strong>Процент побед:</strong>{" "}
                {user.games_played > 0
                  ? ((user.wins / user.games_played) * 100).toFixed(1)
                  : 0}
                %
              </div>
            </div>

            {/* Отладочная информация */}
            <details className={styles.debugInfo}>
              <summary>Данные пользователя (Debug)</summary>
              <pre>{JSON.stringify(user, null, 2)}</pre>
            </details>
          </>
        ) : (
          <div className={styles.noUser}>
            <h2>Пользователь не авторизован</h2>
            <p>
              Приложение должно быть открыто через Telegram Mini App для
              автоматической авторизации.
            </p>
            <div className={styles.hint}>
              <p>
                <strong>Для разработки:</strong> убедитесь, что переменная
                окружения <code>VITE_API_BASE_URL</code> настроена правильно.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
