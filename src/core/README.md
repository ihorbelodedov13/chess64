# Chess API Module

Модуль для работы с REST API шахматного приложения.

## 🔒 Требования к заголовкам

API использует следующие заголовки для безопасности и авторизации:

### 1. X-API-KEY (обязательный)

Защита API на уровне заголовков запросов:

```
X-API-KEY: c7fdac45-3d59-4865-9671-f72c0fac468b
```

Этот заголовок **автоматически добавляется ко всем запросам**.

### 2. Authorization (для авторизации пользователя)

Авторизация пользователя через Telegram initData:

```
Authorization: <telegram_init_data>
```

Где `<telegram_init_data>` - это строка, полученная из `window.Telegram.WebApp.initData`.

**Важно:** Заголовок `Authorization` содержит напрямую initData (не Bearer токен!).

Этот заголовок **автоматически добавляется**, если приложение запущено в Telegram WebApp.

## 📋 Содержание

- [Установка](#установка)
- [Конфигурация](#конфигурация)
- [Быстрый старт](#быстрый-старт)
- [API Reference](#api-reference)
- [Авторизация](#авторизация)
- [Примеры использования](#примеры-использования)
- [Обработка ошибок](#обработка-ошибок)

## 🚀 Установка

Axios уже установлен в проекте. Если нужно установить отдельно:

```bash
npm install axios
```

## ⚙️ Конфигурация

Создайте файл `.env` в корне проекта:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_KEY=c7fdac45-3d59-4865-9671-f72c0fac468b
```

**По умолчанию:**

- `VITE_API_BASE_URL` = `http://localhost:8000`
- `VITE_API_KEY` = `c7fdac45-3d59-4865-9671-f72c0fac468b`

## 🏁 Быстрый старт

### Базовое использование

```typescript
import { fetchMe, setAuthToken } from "./core/api";

// Установка токена авторизации
setAuthToken("your-jwt-token");

// Получение информации о текущем пользователе
const { data } = await fetchMe();
console.log(data);
```

### Использование с React хуками

```typescript
import { useApi } from "./hooks/useApi";
import { fetchMe } from "./core/api";

function UserProfile() {
  const { data, loading, error, execute } = useApi(fetchMe);

  useEffect(() => {
    execute();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Hello, {data?.first_name}!</div>;
}
```

## 📚 API Reference

### Управление токеном

#### `setAuthToken(token: string | null)`

Устанавливает токен авторизации. Токен сохраняется в localStorage.

```typescript
setAuthToken("your-jwt-token");
```

#### `getAuthToken(): string | null`

Получает текущий токен авторизации.

```typescript
const token = getAuthToken();
```

#### `clearAuthToken()`

Очищает токен авторизации.

```typescript
clearAuthToken();
```

### Auth Endpoints

#### `authUser()`

Получение информации о пользователе из Telegram initData.

**Возвращает:** `Promise<AxiosResponse<TelegramUser>>`

```typescript
const { data: user } = await authUser();
```

#### `fetchMe()`

Получение полной информации о текущем пользователе из базы данных.

**Возвращает:** `Promise<AxiosResponse<UserResponse>>`

```typescript
const { data: me } = await fetchMe();
```

#### `fetchUserStats(userId: number)`

Получение статистики пользователя по ID.

**Параметры:**

- `userId` - ID пользователя

**Возвращает:** `Promise<AxiosResponse<UserStats>>`

```typescript
const { data: stats } = await fetchUserStats(123);
```

### Game Endpoints

#### `getAvailableGames()`

Получение списка доступных для присоединения игр.

**Возвращает:** `Promise<AxiosResponse<GameResponse[]>>`

```typescript
const { data: games } = await getAvailableGames();
```

#### `createGame()`

Создание новой игры для присоединения других игроков.

**Возвращает:** `Promise<AxiosResponse<GameResponse>>`

```typescript
const { data: game } = await createGame();
```

#### `createBotGame(data: CreateBotGameRequest)`

Создание игры с ботом.

**Параметры:**

```typescript
{
  difficulty?: 'easy' | 'medium' | 'hard';
  time_control?: {
    base: number;      // Базовое время в секундах
    increment: number; // Инкремент в секундах
  };
}
```

**Возвращает:** `Promise<AxiosResponse<GameResponse>>`

```typescript
const { data: botGame } = await createBotGame({
  difficulty: "hard",
  time_control: { base: 600, increment: 10 },
});
```

#### `joinGame(gameId: number)`

Присоединение к существующей игре.

**Параметры:**

- `gameId` - ID игры

**Возвращает:** `Promise<AxiosResponse<JoinGameResponse>>`

```typescript
const { data: joinResult } = await joinGame(123);
```

#### `getGameInfo(gameId: number)`

Получение информации об игре.

**Параметры:**

- `gameId` - ID игры

**Возвращает:** `Promise<AxiosResponse<unknown>>`

```typescript
const { data: gameInfo } = await getGameInfo(123);
```

#### `resignGame(gameId: number)`

Сдача в игре.

**Параметры:**

- `gameId` - ID игры

**Возвращает:** `Promise<AxiosResponse<unknown>>`

```typescript
await resignGame(123);
```

### Matchmaking Endpoints

#### `joinMatchmaking()`

Вход в очередь автоматического подбора соперника.

**Возвращает:** `Promise<AxiosResponse<unknown>>`

```typescript
await joinMatchmaking();
```

#### `leaveMatchmaking()`

Выход из очереди матчмейкинга.

**Возвращает:** `Promise<AxiosResponse<unknown>>`

```typescript
await leaveMatchmaking();
```

#### `getMatchmakingStatus()`

Получение статуса в очереди матчмейкинга.

**Возвращает:** `Promise<AxiosResponse<unknown>>`

```typescript
const { data: status } = await getMatchmakingStatus();
```

### Health Check

#### `healthCheck()`

Проверка здоровья сервера.

**Возвращает:** `Promise<AxiosResponse<unknown>>`

```typescript
const { data } = await healthCheck();
```

## 🔐 Авторизация

API использует **Telegram WebApp initData** для авторизации пользователей.

### Автоматическая авторизация

Если приложение запущено в Telegram WebApp:

```typescript
import { fetchMe } from "./core/api";

// initData автоматически берётся из window.Telegram.WebApp.initData
// и добавляется в заголовок Authorization
const { data } = await fetchMe();
```

### Ручное управление initData (опционально)

Если нужно сохранить initData между сессиями:

```typescript
import {
  setCachedInitData,
  getCachedInitData,
  clearCachedInitData,
} from "./core/api";

// Сохранить initData
const initData = window.Telegram?.WebApp?.initData;
setCachedInitData(initData);

// Получить сохраненный initData
const cached = getCachedInitData();

// Очистить при выходе
clearCachedInitData();
```

### Обратная совместимость

Старые функции `setAuthToken`, `getAuthToken`, `clearAuthToken` все еще работают (они просто алиасы для новых функций):

```typescript
// Устаревший способ (работает, но deprecated)
setAuthToken(initData);

// Рекомендуемый способ
setCachedInitData(initData);
```

## 💡 Примеры использования

### Создание игры с ботом

```typescript
import { createBotGame } from "./core/api";

async function startBotGame() {
  try {
    const { data: game } = await createBotGame({
      difficulty: "medium",
      time_control: {
        base: 600, // 10 минут
        increment: 5, // +5 секунд за ход
      },
    });

    console.log("Игра создана:", game);
    // Переход к игре через WebSocket
  } catch (error) {
    console.error("Ошибка создания игры:", error);
  }
}
```

### Поиск игры через матчмейкинг

```typescript
import {
  joinMatchmaking,
  getMatchmakingStatus,
  leaveMatchmaking,
} from "./core/api";

async function findGame() {
  try {
    // Войти в очередь
    await joinMatchmaking();

    // Периодически проверять статус
    const interval = setInterval(async () => {
      const { data: status } = await getMatchmakingStatus();

      if (status.game_found) {
        clearInterval(interval);
        console.log("Игра найдена!", status.game_id);
      }
    }, 2000);

    // Выход из очереди (если пользователь отменил)
    // await leaveMatchmaking();
  } catch (error) {
    console.error("Ошибка матчмейкинга:", error);
  }
}
```

### Использование с Zustand Store

```typescript
import { create } from "zustand";
import { fetchMe, clearAuthToken } from "./core/api";
import type { UserResponse } from "../types/api";

interface UserStore {
  user: UserResponse | null;
  loading: boolean;
  loadUser: () => Promise<void>;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: false,

  loadUser: async () => {
    set({ loading: true });
    try {
      const { data } = await fetchMe();
      set({ user: data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  logout: () => {
    clearAuthToken();
    set({ user: null });
  },
}));
```

### Использование useApi хука

```typescript
import { useApi } from "./hooks/useApi";
import { getAvailableGames, joinGame } from "./core/api";

function GamesList() {
  const {
    data: games,
    loading,
    execute: loadGames,
  } = useApi(getAvailableGames);
  const { execute: joinGameExecute } = useApi(joinGame);

  useEffect(() => {
    loadGames();
  }, []);

  const handleJoinGame = async (gameId: number) => {
    const result = await joinGameExecute(gameId);
    if (result) {
      console.log("Присоединились к игре:", result);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {games?.map((game) => (
        <div key={game.id}>
          <h3>Game {game.id}</h3>
          <button onClick={() => handleJoinGame(game.id)}>Join Game</button>
        </div>
      ))}
    </div>
  );
}
```

## ⚠️ Обработка ошибок

### Автоматическая обработка

API модуль автоматически обрабатывает следующие ошибки:

- **401 Unauthorized** - очищает токен авторизации
- **404 Not Found** - логирует предупреждение
- **500+ Server Errors** - логирует ошибку сервера
- **Network Errors** - логирует сетевые ошибки

### Ручная обработка

```typescript
import { fetchMe } from "./core/api";
import { AxiosError } from "axios";

async function loadUser() {
  try {
    const { data } = await fetchMe();
    console.log("User:", data);
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 401) {
        // Перенаправление на страницу авторизации
        window.location.href = "/login";
      } else if (error.response?.status === 404) {
        console.warn("User not found");
      } else {
        console.error("API Error:", error.response?.data);
      }
    } else {
      console.error("Unknown error:", error);
    }
  }
}
```

## 🔧 Расширенное использование

### Прямое использование axios instance

```typescript
import api from "./core/api";

// Можно использовать axios instance напрямую
const response = await api.get("/custom-endpoint");

// Или с дополнительными опциями
const response = await api.post(
  "/custom-endpoint",
  {
    data: "value",
  },
  {
    headers: {
      "Custom-Header": "value",
    },
  }
);
```

## 📝 Типы

Все типы доступны в `src/types/api.ts`:

```typescript
import type {
  TelegramUser,
  UserResponse,
  UserStats,
  GameResponse,
  JoinGameResponse,
  CreateBotGameRequest,
  BotDifficulty,
  TimeControl,
} from "../types/api";
```

## 🧪 Примеры

Больше примеров смотрите в файле `src/core/api.examples.ts`.
