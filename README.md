# SiberianGym

Рабочая (не демо) версия экосистемы фитнес-клуба: приложения для клиента, тренера,
администратора и CEO на одной базе данных.

Демо-версия, на основе которой спроектирована модель данных, лежит отдельно в
`E:\project_gym` и не используется в этом репозитории напрямую — заказчику она
ещё не показана.

## Структура

- `api/` — backend (NestJS + Prisma + PostgreSQL), включая `Dockerfile`
- `web/` — frontend (React + TypeScript + PWA), включая `Dockerfile` и `nginx.conf`
- `docker-compose.yml` — локальная PostgreSQL для разработки
- `docker-compose.prod.yml` — полное продакшн-развёртывание (Postgres + API + web одним `docker compose`)

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

## Развёртывание в продакшн (Docker)

Собрано и проверено на локальном Docker: Postgres + API + фронтенд (nginx)
одним `docker compose`, миграции применяются автоматически при старте
контейнера API, письма без настроенного SMTP просто не отправляются
(см. CHANGELOG 0.12.0).

```bash
# На сервере (например, свежий VPS с установленным Docker + Docker Compose):
git clone https://github.com/m9059554405-del/siberiangym.git
cd siberiangym

cp .env.prod.example .env.prod
# заполнить .env.prod: POSTGRES_PASSWORD, JWT_SECRET (длинные случайные строки),
# SEED_CEO_EMAIL/SEED_CEO_PASSWORD (логин первого CEO), при желании SMTP_*

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Один раз после первого запуска — создать зал, первого CEO и библиотеку упражнений:
docker compose -f docker-compose.prod.yml exec api node dist/prisma-seed/seed.js
```

Приложение будет доступно на порту 80 сервера (`http://<IP сервера>/`) —
фронтенд и API отдаются с одного порта, `/api/*` нginx проксирует на
контейнер backend.

### Обновление после изменений в коде

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Миграции применяются автоматически при каждом старте контейнера API
(`prisma migrate deploy` — безопасно для уже применённых миграций).

### HTTPS и домен

Через HTTP уходят JWT, пароли при логине и персональные/медицинские данные
клиентов — HTTPS не техдолг «на потом», а условие выхода в прод (P0.2).
[Caddy](https://caddyserver.com/) уже встроен в `docker-compose.prod.yml`
как отдельный сервис перед `web` и управляется одной переменной `DOMAIN`
в `.env.prod`:

- **`DOMAIN` пустая** (по умолчанию, пока нет домена) — Caddy слушает
  обычный порт 80, приложение работает по IP, как раньше.
- **`DOMAIN=ваш-домен.ru`** (когда его A-запись уже указывает на IP этого
  сервера) — после `docker compose ... up -d --build` Caddy сам получает
  и продлевает сертификат Let's Encrypt, ничего больше настраивать не
  нужно. Подробный порядок действий — в DEPLOY_GUIDE.md, часть 5.

### Фото клиентов и объектное хранилище (S3)

Фото прогресса/еды/профиля с P0.5 хранятся не в базе данных, а в
S3-совместимом объектном хранилище — в БД остаётся только ссылка. На
клиенте фото сжимается перед отправкой (canvas, до ~1600px по длинной
стороне), на сервере принимается через multipart и грузится в S3.
Целевая конфигурация — отдельное S3-хранилище (Selectel S3 и т.п.), не
локальный диск сервера: заполните переменные `S3_*` в `.env.prod` (см.
`.env.prod.example` и DEPLOY_GUIDE.md, часть 6). Пока хранилище не
настроено, остальное приложение работает нормально — не работает только
загрузка фото. Для локальной разработки уже поднят MinIO в
`docker-compose.yml` (`docker compose up -d`), донастраивать ничего не нужно.

### Хостинг

Для одного зала (~330 пользователей, небольшая нагрузка) достаточно самого
младшего VPS с 2 vCPU / 2–4 ГБ RAM. Из бюджетных и надёжных российских
провайдеров (важно из-за юрисдикции данных и будущей интеграции с
Альфа-Банком) в первую очередь стоит посмотреть:

- **Timeweb Cloud** — обычно лучшее соотношение цена/надёжность для такой
  нагрузки, есть готовые образы с Docker, младшие тарифы от нескольких
  сотен рублей в месяц.
- **Selectel** — чуть дороже, но с более высоким SLA, если важнее
  стабильность, чем цена.
- **Beget** / **RUVDS** — тоже бюджетные варианты, стоит сравнить
  актуальные цены на момент выбора.

Это моя рекомендация по направлению поиска, а не готовое решение — цены и
тарифы стоит свериться перед оплатой, сам аккаунт и оплату я не оформляю.

## Индекс структуры кода

`scripts/code_structure.py` строит компактный индекс Python/TypeScript/JavaScript:
классы, функции, методы, сигнатуры, docstring/JSDoc и точные диапазоны строк без тел.

```bash
python scripts/code_structure.py . --include-docs -o structure.md
python scripts/code_structure.py api/src --format json -o structure.json
python scripts/code_structure.py api/src --symbol AuthService.login
```

Последняя команда точечно выводит тело найденного символа. Каталоги `.git`,
`node_modules`, `dist`, `build`, виртуальные окружения и кэш исключаются автоматически;
дополнительные каталоги исключаются повторяемым параметром `--exclude`.

## Статус разработки

См. [CHANGELOG.md](./CHANGELOG.md).
