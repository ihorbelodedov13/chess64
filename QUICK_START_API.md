# 🚀 Быстрый старт: Работа с API

Это руководство поможет вам быстро начать работать с API модулем в шахматном приложении.

## 🔒 Важно: Заголовки API

API защищен двумя заголовками:

1. **X-API-KEY**: `c7fdac45-3d59-4865-9671-f72c0fac468b` (автоматически добавляется)
2. **Authorization**: Telegram initData (автоматически из `window.Telegram.WebApp.initData`)

## 📦 Что уже готово

✅ Axios установлен и настроен  
✅ API interceptors для авторизации  
✅ Все API endpoints реализованы  
✅ TypeScript типы для всех запросов  
✅ React хуки для удобной работы с API  
✅ Примеры компонентов  
✅ Автоматическая инициализация приложения

## ⚙️ Настройка

### 1. Создайте файл `.env`

```bash
cp .env.example .env
```

### 2. Настройте URL API и ключ

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_KEY=c7fdac45-3d59-4865-9671-f72c0fac468b
```

API ключ используется по умолчанию, но можно переопределить в `.env`.

## 🎯 Основные функции

### Авторизация

Приложение автоматически инициализируется при загрузке (`App.tsx`):

```typescript
import { initializeApp } from "./core/init";

useEffect(() => {
  initializeApp();
}, []);
```

Это автоматически:

- Проверяет сохраненный токен
- Авторизует через Telegram WebApp
- Загружает данные пользователя

### Ручная работа с initData

```typescript
import {
  setCachedInitData,
  getCachedInitData,
  clearCachedInitData,
} from "./core/api";

// Сохранить Telegram initData (если нужно)
const initData = window.Telegram?.WebApp?.initData;
setCachedInitData(initData);

// Получить сохраненный initData
const cached = getCachedInitData();

// Очистить при выходе
clearCachedInitData();
```

## 📝 Примеры использования

### 1. Получить информацию о пользователе

```typescript
import { fetchMe } from "./core/api";

const { data: user } = await fetchMe();
console.log(user);
```

### 2. Создать игру с ботом

```typescript
import { createBotGame } from "./core/api";

const { data: game } = await createBotGame({
  difficulty: "hard",
  time_control: { base: 600, increment: 5 },
});
```

### 3. Найти игру через матчмейкинг

```typescript
import { joinMatchmaking, getMatchmakingStatus } from "./core/api";

// Войти в очередь
await joinMatchmaking();

// Проверить статус
const { data: status } = await getMatchmakingStatus();
```

### 4. Использование с React хуком

```typescript
import { useApi } from "./hooks/useApi";
import { fetchMe } from "./core/api";

function MyComponent() {
  const { data, loading, error, execute } = useApi(fetchMe);

  useEffect(() => {
    execute();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>Hello, {data?.first_name}!</div>;
}
```

## 🎨 Готовые компоненты

### GameCreator

Компонент для создания игр (с игроками, ботом, матчмейкинг)

```typescript
import { GameCreator } from "./components/GameCreator";

function MyPage() {
  return <GameCreator />;
}
```

### GamesList

Список доступных игр с возможностью присоединения

```typescript
import { GamesList } from "./components/GamesList";

function MyPage() {
  return <GamesList />;
}
```

### UserProfile

Профиль пользователя (свой или другого)

```typescript
import { UserProfile } from "./components/UserProfile";

function MyPage() {
  return <UserProfile />; // Свой профиль
  // или
  return <UserProfile userId={123} />; // Профиль другого пользователя
}
```

## 🔥 Полный пример страницы

```typescript
import { useEffect } from "react";
import { useAppStore } from "./stores/useAppStore";
import { GameCreator } from "./components/GameCreator";
import { GamesList } from "./components/GamesList";
import { UserProfile } from "./components/UserProfile";

function OnlineGamePage() {
  const { user, isLoading } = useAppStore();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Please login</div>;
  }

  return (
    <div>
      <UserProfile />
      <GameCreator />
      <GamesList />
    </div>
  );
}

export default OnlineGamePage;
```

## 📚 Доступные API функции

### Auth

- `authUser()` - Авторизация через Telegram
- `fetchMe()` - Получить свои данные
- `fetchUserStats(userId)` - Статистика пользователя

### Games

- `getAvailableGames()` - Список доступных игр
- `createGame()` - Создать игру
- `createBotGame(options)` - Создать игру с ботом
- `joinGame(gameId)` - Присоединиться к игре
- `getGameInfo(gameId)` - Информация об игре
- `resignGame(gameId)` - Сдаться

### Matchmaking

- `joinMatchmaking()` - Войти в очередь
- `leaveMatchmaking()` - Выйти из очереди
- `getMatchmakingStatus()` - Статус в очереди

### Utility

- `healthCheck()` - Проверка сервера

## 🔐 Авторизация

### Заголовки API

API использует два обязательных заголовка:

1. **X-API-KEY**: `c7fdac45-3d59-4865-9671-f72c0fac468b`

   - Добавляется автоматически ко всем запросам
   - Настраивается через `VITE_API_KEY` в `.env`

2. **Authorization**: Telegram initData
   - Автоматически берется из `window.Telegram.WebApp.initData`
   - Содержит данные авторизации пользователя
   - **НЕ использует Bearer токен**, передается напрямую

### Автоматическая работа

```typescript
// Всё работает автоматически, если приложение запущено в Telegram
const { data } = await fetchMe();
```

### Ручное управление (опционально)

```typescript
import { setCachedInitData } from "./core/api";

// Сохранить initData для повторного использования
const initData = window.Telegram?.WebApp?.initData;
setCachedInitData(initData);
```

## 🛠️ Обработка ошибок

### Автоматическая

- 401 → очищает кешированный initData
- 404 → логирует предупреждение
- 500+ → логирует ошибку

### Ручная

```typescript
try {
  const { data } = await fetchMe();
} catch (error) {
  console.error("Error:", error);
}
```

## 📖 Больше информации

- **Детальная документация**: `src/core/README.md`
- **Примеры кода**: `src/core/api.examples.ts`
- **Типы**: `src/types/api.ts`
- **Telegram WebApp типы**: `src/types/telegram.d.ts`

## 🎓 Типичные сценарии

### Сценарий 1: Создание игры

```typescript
// 1. Создать игру
const { data: game } = await createGame();

// 2. Подключиться через WebSocket
// (используйте socketService)
```

### Сценарий 2: Быстрая игра

```typescript
// 1. Войти в очередь
await joinMatchmaking();

// 2. Ждать результата
const interval = setInterval(async () => {
  const { data: status } = await getMatchmakingStatus();
  if (status.game_found) {
    clearInterval(interval);
    // Подключиться к игре
  }
}, 2000);
```

### Сценарий 3: Игра с ботом

```typescript
// 1. Создать игру с ботом
const { data: botGame } = await createBotGame({
  difficulty: "medium",
  time_control: { base: 600, increment: 10 },
});

// 2. Подключиться через WebSocket
// socketService.connect()
```

## 💡 Советы

1. **Используйте TypeScript** - все типы уже готовы
2. **Используйте хуки** - `useApi` упрощает работу
3. **Обрабатывайте ошибки** - всегда проверяйте результат
4. **Сохраняйте токен** - используйте `setAuthToken`
5. **Смотрите примеры** - в `api.examples.ts` есть все

## 🐛 Отладка

```typescript
// Проверить токен
console.log(getAuthToken());

// Проверить пользователя
console.log(useAppStore.getState().user);

// Проверить сервер
const { data } = await healthCheck();
console.log(data);
```

---

Удачи! 🎉
