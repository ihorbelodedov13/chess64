# ⚙️ Настройка переменных окружения

## Создание .env файла

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000
VITE_API_KEY=c7fdac45-3d59-4865-9671-f72c0fac468b

# WebSocket Configuration (optional)
VITE_WS_URL=ws://localhost:8000
```

## Быстрая команда

```bash
cat > .env << 'EOF'
VITE_API_BASE_URL=http://localhost:8000
VITE_API_KEY=c7fdac45-3d59-4865-9671-f72c0fac468b
VITE_WS_URL=ws://localhost:8000
EOF
```

## Описание переменных

### VITE_API_BASE_URL

- **Обязательная**: Да
- **По умолчанию**: `http://localhost:8000`
- **Описание**: Базовый URL для API запросов

### VITE_API_KEY

- **Обязательная**: Да
- **По умолчанию**: `c7fdac45-3d59-4865-9671-f72c0fac468b`
- **Описание**: API ключ для защиты запросов (добавляется в заголовок X-API-KEY)

### VITE_WS_URL

- **Обязательная**: Нет
- **По умолчанию**: Нет
- **Описание**: URL для WebSocket соединений (если отличается от API_BASE_URL)

## Проверка

После создания файла проверьте, что переменные загрузились:

```typescript
console.log(import.meta.env.VITE_API_BASE_URL);
console.log(import.meta.env.VITE_API_KEY);
```

## Важно

- ⚠️ Файл `.env` должен быть в `.gitignore` (уже добавлен)
- ⚠️ Не коммитьте файл `.env` в репозиторий
- ⚠️ Для production используйте другой API ключ
- ⚠️ После изменения `.env` нужно перезапустить dev сервер

## Production

Для production окружения настройте переменные в вашей платформе деплоя:

- Vercel: Settings → Environment Variables
- Netlify: Site settings → Build & deploy → Environment
- Docker: Используйте `.env` файл или аргументы командной строки

## Безопасность

🔒 **Никогда не храните секреты в коде!**

Все переменные начинающиеся с `VITE_` будут доступны в клиентском коде, поэтому:

- ✅ API ключи для публичных API - можно
- ❌ Приватные ключи, пароли БД - нельзя
- ❌ Секретные токены - нельзя

Для серверных секретов используйте переменные без префикса `VITE_`.
