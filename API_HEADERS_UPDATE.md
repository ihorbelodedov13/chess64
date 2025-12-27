# 🔄 Обновление: Добавлены заголовки API

## 📝 Что изменилось

### 1. Добавлен заголовок X-API-KEY

**Заголовок**: `X-API-KEY: c7fdac45-3d59-4865-9671-f72c0fac468b`

- ✅ Автоматически добавляется ко всем запросам
- ✅ Настраивается через переменную окружения `VITE_API_KEY`
- ✅ По умолчанию: `c7fdac45-3d59-4865-9671-f72c0fac468b`

### 2. Изменена логика заголовка Authorization

**Старая логика** (Bearer токен):

```
Authorization: Bearer <jwt-token>
```

**Новая логика** (Telegram initData):

```
Authorization: <telegram_init_data>
```

- ✅ Используется Telegram initData **напрямую** (без Bearer префикса)
- ✅ Автоматически берется из `window.Telegram.WebApp.initData`
- ✅ Кешируется в localStorage для повторного использования

## 🔧 Изменения в коде

### Файлы, которые были изменены:

1. **`src/core/api.ts`** - основной API модуль

   - Добавлен `X-API-KEY` в заголовки axios instance
   - Изменен request interceptor для использования initData вместо Bearer токена
   - Переименованы функции управления токенами:
     - `setCachedInitData()` - новая, рекомендуемая
     - `getCachedInitData()` - новая, рекомендуемая
     - `clearCachedInitData()` - новая, рекомендуемая
     - `setAuthToken()`, `getAuthToken()`, `clearAuthToken()` - deprecated, но работают

2. **`src/vite-env.d.ts`**

   - Добавлен тип для `VITE_API_KEY`

3. **`src/core/index.ts`**

   - Экспортированы новые функции управления initData

4. **Документация**
   - Обновлен `src/core/README.md`
   - Обновлен `QUICK_START_API.md`
   - Обновлен `API_IMPLEMENTATION_SUMMARY.md`

## 📦 Переменные окружения

Обновите ваш файл `.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_KEY=c7fdac45-3d59-4865-9671-f72c0fac468b
```

## 🚀 Как использовать

### Автоматически (рекомендуется)

Ничего не нужно делать! Заголовки добавляются автоматически:

```typescript
import { fetchMe } from "./core/api";

// X-API-KEY и Authorization добавляются автоматически
const { data } = await fetchMe();
```

### Ручное управление initData (опционально)

Если нужно кешировать initData:

```typescript
import {
  setCachedInitData,
  getCachedInitData,
  clearCachedInitData,
} from "./core/api";

// Сохранить
const initData = window.Telegram?.WebApp?.initData;
setCachedInitData(initData);

// Получить
const cached = getCachedInitData();

// Очистить
clearCachedInitData();
```

## ⚠️ Обратная совместимость

Старые функции работают, но помечены как deprecated:

```typescript
// ❌ Устаревший способ (работает, но не рекомендуется)
setAuthToken(initData);
getAuthToken();
clearAuthToken();

// ✅ Новый рекомендуемый способ
setCachedInitData(initData);
getCachedInitData();
clearCachedInitData();
```

## 🔍 Технические детали

### Request Interceptor

```typescript
api.interceptors.request.use((config) => {
  // 1. Добавление X-API-KEY (автоматически из константы)
  config.headers["X-API-KEY"] = API_KEY;

  // 2. Добавление Authorization с Telegram initData
  const initData = getTelegramInitData() || getCachedInitData();
  if (initData) {
    config.headers.Authorization = initData; // БЕЗ "Bearer "!
  }

  return config;
});
```

### Response Interceptor

```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Очищаем кешированный initData при ошибке авторизации
      clearCachedInitData();
    }
    return Promise.reject(error);
  }
);
```

## ✅ Проверка

### 1. Проверьте заголовки в DevTools

Откройте Network tab и проверьте любой запрос к API:

```
Headers:
  X-API-KEY: c7fdac45-3d59-4865-9671-f72c0fac468b
  Authorization: query_id=...&user=...&auth_date=...&hash=...
  Content-Type: application/json
```

### 2. Проверьте, что initData получается

```typescript
console.log(window.Telegram?.WebApp?.initData);
// Должно вывести строку с данными авторизации
```

### 3. Проверьте кеширование

```typescript
import { getCachedInitData } from "./core/api";
console.log(getCachedInitData());
// Должно вывести сохраненный initData или null
```

## 🐛 Устранение неполадок

### Проблема: 401 Unauthorized

**Причины:**

1. Приложение не запущено в Telegram WebApp
2. InitData недоступен
3. InitData невалидный или истек

**Решение:**

```typescript
// Проверьте наличие initData
if (window.Telegram?.WebApp?.initData) {
  console.log("InitData доступен");
} else {
  console.error("Запустите приложение в Telegram");
}
```

### Проблема: API ключ не принимается

**Причины:**

1. Неверный ключ в `.env`
2. `.env` не загружен

**Решение:**

```typescript
// Проверьте переменные окружения
console.log(import.meta.env.VITE_API_KEY);
```

## 📚 Дополнительная информация

- **Telegram WebApp документация**: https://core.telegram.org/bots/webapps
- **Детальная документация**: `src/core/README.md`
- **Примеры использования**: `src/core/api.examples.ts`
- **Быстрый старт**: `QUICK_START_API.md`

---

**Дата обновления**: 2025-11-04  
**Версия**: 1.1.0

Все изменения обратно совместимы! ✅
