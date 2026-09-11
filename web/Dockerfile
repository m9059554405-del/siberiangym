# Продакшн-образ фронтенда: собираем статику Vite-сборкой, отдаём nginx'ом.
# HashRouter (см. App.tsx) — статика раздаётся как есть, без правил
# перезаписи путей на index.html, которые нужны были бы для BrowserRouter.

FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
