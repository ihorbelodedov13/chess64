/**
 * Компонент профиля пользователя
 * Демонстрирует использование API и store
 */

import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useApi } from "../hooks/useApi";
import { fetchUserStats } from "../core/api";
import { logout } from "../core/init";

interface UserProfileProps {
  userId?: number;
}

export function UserProfile({ userId }: UserProfileProps) {
  const { user } = useAppStore();
  const { data: stats, loading, error, execute } = useApi(fetchUserStats);

  // Загружаем статистику при монтировании или изменении userId
  useEffect(() => {
    if (userId) {
      execute(userId);
    }
  }, [userId, execute]);

  const handleLogout = () => {
    logout();
    // Опционально: редирект на главную
    // navigate('/');
  };

  // Если пользователь не авторизован
  if (!user && !userId) {
    return (
      <div style={{ padding: "20px" }}>
        <h3>Пользователь не авторизован</h3>
        <p>Пожалуйста, авторизуйтесь через Telegram</p>
      </div>
    );
  }

  // Показываем текущего пользователя из store
  if (!userId && user) {
    return (
      <div
        style={{
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      >
        <h2>Мой профиль</h2>

        <div style={{ marginBottom: "15px" }}>
          {user.photo_url && (
            <img
              src={user.photo_url}
              alt={user.first_name}
              style={{ width: "80px", height: "80px", borderRadius: "50%" }}
            />
          )}
          <h3>
            {user.first_name} {user.last_name}
          </h3>
          {user.username && <p>@{user.username}</p>}
        </div>

        <div style={{ marginBottom: "15px" }}>
          <p>
            <strong>Рейтинг:</strong> {user.rating}
          </p>
          <p>
            <strong>Игр сыграно:</strong> {user.games_played}
          </p>
          <p>
            <strong>Побед:</strong> {user.wins}
          </p>
          <p>
            <strong>Поражений:</strong> {user.losses}
          </p>
          <p>
            <strong>Ничьих:</strong> {user.draws}
          </p>
          <p>
            <strong>Онлайн:</strong> {user.online ? "Да" : "Нет"}
          </p>
        </div>

        <div>
          <p>
            <strong>Последний визит:</strong>{" "}
            {new Date(user.last_online).toLocaleString("ru-RU")}
          </p>
          <p>
            <strong>Зарегистрирован:</strong>{" "}
            {new Date(user.created_at).toLocaleString("ru-RU")}
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Выйти
        </button>
      </div>
    );
  }

  // Показываем статистику другого пользователя
  if (loading) {
    return <div style={{ padding: "20px" }}>Загрузка...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        Ошибка загрузки: {error}
      </div>
    );
  }

  if (!stats) {
    return <div style={{ padding: "20px" }}>Пользователь не найден</div>;
  }

  return (
    <div
      style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}
    >
      <h2>Профиль пользователя</h2>

      <div style={{ marginBottom: "15px" }}>
        {stats.photo_url && (
          <img
            src={stats.photo_url}
            alt={stats.first_name}
            style={{ width: "80px", height: "80px", borderRadius: "50%" }}
          />
        )}
        <h3>
          {stats.first_name} {stats.last_name}
        </h3>
        {stats.username && <p>@{stats.username}</p>}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <p>
          <strong>Рейтинг:</strong> {stats.rating}
        </p>
        <p>
          <strong>Игр сыграно:</strong> {stats.games_played}
        </p>
        <p>
          <strong>Онлайн:</strong> {stats.online ? "Да" : "Нет"}
        </p>
      </div>

      <div>
        <p>
          <strong>Последний визит:</strong>{" "}
          {new Date(stats.last_online).toLocaleString("ru-RU")}
        </p>
      </div>
    </div>
  );
}
