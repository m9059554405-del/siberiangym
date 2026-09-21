# Продакшн-образ API. node:*-slim (Debian), не alpine — bcrypt собирает
# нативный биндинг при установке, а с musl (alpine) в этом проекте уже
# были проблемы с нативными зависимостями на другом пакете (rolldown у
# фронтенда), поэтому сознательно используем glibc-базу.
#
# Версия Node зафиксирована (22.11.0), не "22-slim" — на более новых 22.x
# (проверено на 22.23) поведение загрузчика .ts-файлов меняется настолько,
# что даже прямой запуск через ts-node в контейнере ломается непредсказуемо.
# Сидирование поэтому не полагается на ts-node в рантайм-образе вообще —
# seed.ts компилируется в обычный JS здесь же, на этапе сборки.

FROM node:22.11.0-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Компилируем seed-скрипт отдельно от основной сборки (tsconfig.build.json
# исключает prisma/) — обычным tsc, без ts-node, в чистый CommonJS JS.
# emergency-ceo-reset (P3.12) компилируется тем же способом: аварийный
# сброс доступа CEO выполняется в контейнере против прод-базы.
RUN npx tsc prisma/seed.ts prisma/exercise-library.ts prisma/emergency-ceo-reset.ts \
    --outDir dist/prisma-seed --module commonjs --target es2022 \
    --moduleResolution node --esModuleInterop --skipLibCheck --resolveJsonModule

FROM node:22.11.0-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# curl нужен healthcheck'у из docker-compose.prod.yml (curl -fsS .../api/health)
# — в node:*-slim его нет, без него контейнер вечно помечался unhealthy.
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

# P3.18: pm2-runtime запускает API по ecosystem.config.js (CMD ниже) —
# раньше файл не копировался в runner-образ, и контейнер падал на старте
# с ENOENT: /app/ecosystem.config.js (PM2 successfully stopped в цикле).
COPY ecosystem.config.js ./

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Применяем миграции к базе перед каждым запуском — безопасно и для
# первого разворачивания, и для последующих обновлений (prisma migrate
# deploy не трогает уже применённые миграции). Сид — отдельной командой
# после первого поднятия: docker compose exec api node dist/prisma-seed/seed.js
# P3.18: API стартует через pm2-runtime в кластерном режиме (ecosystem.config.js)
# — N воркеров на всех ядрах вместо одного event loop; фоновые задачи
# выполняет только воркер 0 (common/dispatcher.ts).
CMD ["sh", "-c", "npx prisma migrate deploy && npx pm2-runtime start ecosystem.config.js"]
