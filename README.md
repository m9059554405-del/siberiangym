# SiberianGym

Рабочая (не демо) версия экосистемы фитнес-клуба: приложения для клиента, тренера,
администратора и CEO на одной базе данных.

Демо-версия, на основе которой спроектирована модель данных, лежит отдельно в
`E:\project_gym` и не используется в этом репозитории напрямую — заказчику она
ещё не показана.

## Структура

- `api/` — backend (NestJS + Prisma + PostgreSQL)
- `web/` — frontend (React + TypeScript, портируется из демо-версии)
- `docker-compose.yml` — локальная PostgreSQL для разработки

## Быстрый старт (разработка)

```bash
# 1. Поднять базу данных
docker compose up -d

# 2. Backend
cd api
cp .env.example .env      # затем вписать свои значения
npm install
npm run prisma:migrate    # применить миграции
npm run prisma:seed       # создать зал SiberianGym и первого CEO
npm run start:dev         # http://localhost:3000/api
```

Логин первого CEO после сида: `ceo@siberiangym.ru` / `change-me-12345`
(задаётся через `SEED_CEO_EMAIL` / `SEED_CEO_PASSWORD`, обязательно сменить
пароль после первого входа в реальном окружении).

## Статус разработки

См. [CHANGELOG.md](./CHANGELOG.md).
