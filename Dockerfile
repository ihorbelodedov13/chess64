# ── Build Stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# API URL специально оставлен пустым — фронтенд использует относительные URL (/api/v1/...)
# которые nginx проксирует на бэкенд. Это работает с любым доменом (ngrok, прод и т.д.)
ARG VITE_API_BASE_URL=
ARG VITE_DEV_MODE=false
ARG VITE_X_INIT_DATA_KEY=
ARG VITE_BOT_USERNAME=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DEV_MODE=$VITE_DEV_MODE
ENV VITE_X_INIT_DATA_KEY=$VITE_X_INIT_DATA_KEY
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME

RUN npm run build

# ── Serve Stage ───────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
