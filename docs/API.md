# API курьерской платформы

Базовый URL (прод): `https://courier-platform-clfo.onrender.com/api`
Базовый URL (разработка): `http://localhost:4000/api`

Авторизация — JWT в заголовке `Authorization: Bearer <token>`. Роли: `courier`, `admin`.

## Auth
- `POST /api/auth/courier/register` — multipart form: fullName, phone, password, medBookNumber, bikeNumber, photo (файл, опционально)
- `POST /api/auth/courier/login` — { phone, password }
- `POST /api/auth/admin/login` — { phone, password } (админов создаёт `npm run db:seed`)

## Курьеры
- `GET /api/couriers/me` (courier) — свой профиль
- `GET /api/couriers` (admin) — список всех курьеров
- `GET /api/couriers/:id` (admin) — карточка курьера + последние смены/выплаты/обращения

## Смены
- `POST /api/shifts` (admin) — { shifts: [{ courierId, scheduledStart, scheduledEnd }, ...] } — выгрузка расписания
- `DELETE /api/shifts/:id` (admin)
- `GET /api/shifts/me` (courier)
- `GET /api/shifts?courierId=` (admin)
- `POST /api/shifts/:id/check-in` (courier) — отметить выход (LATE, если позже scheduledStart + LATE_GRACE_MINUTES)
- `POST /api/shifts/:id/check-out` (courier)

## Выплаты
- `POST /api/payments` (admin) — { courierId, amount (в копейках), periodFrom, periodTo, note?, markPaid? }
- `PATCH /api/payments/:id/mark-paid` (admin)
- `GET /api/payments/me` (courier) — { balance, payments }
- `GET /api/payments?courierId=` (admin)

## Чат
- `GET /api/chat/me` / `POST /api/chat/me` (courier, multipart: text?, media[] до 5 файлов) — пересылается в Telegram админу
- `GET /api/chat` (admin) — список диалогов с непрочитанными
- `GET /api/chat/:courierId` / `POST /api/chat/:courierId` (admin, multipart: text?, media[])
- `POST /api/chat/internal/from-telegram` — служебный эндпоинт (заголовок X-Service-Token); штатно не используется, т.к. приём ответов из Telegram работает встроенным long-polling'ом (см. ниже), оставлен как резервный путь для внешнего бота

## Обратная связь (опоздание/невыход)
- `POST /api/feedback` (courier, multipart: type=LATE|NO_SHOW|OTHER, reason, shiftId?, media[])
- `GET /api/feedback/me` (courier)
- `GET /api/feedback?courierId=` (admin)
- `PATCH /api/feedback/:id/reviewed` (admin)

## Уведомления
- `GET /api/notifications/me` (courier)
- `GET /api/notifications/me/unread-count` (courier)
- `PATCH /api/notifications/:id/read` (courier)

## Фоновая логика
`src/services/scheduler.ts` каждую минуту проверяет смены:
- если прошло больше `LATE_GRACE_MINUTES` (по умолчанию 15) от начала смены, а чек-ина нет — статус `LATE` + уведомление курьеру;
- если смена уже закончилась, а чек-ина так и не было — статус `NO_SHOW` + уведомление.

`src/services/telegramBot.ts` — если заданы `TELEGRAM_BOT_TOKEN` и `TELEGRAM_ADMIN_CHAT_ID`, при старте сервера
запускается long polling Telegram Bot API в этом же процессе: админ отвечает курьеру, сделав Reply на его
сообщение прямо в Telegram — ответ автоматически попадает в чат курьера в приложении.

### Настройка Telegram-бота (один раз)
1. В Telegram написать **@BotFather** → `/newbot` → придумать имя и username бота → BotFather пришлёт токен вида `123456:AA...`. Это `TELEGRAM_BOT_TOKEN`.
2. Написать что-нибудь своему новому боту (любое сообщение), затем открыть в браузере
   `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и найти `"chat":{"id":ЧИСЛО, ...}` — это ваш `TELEGRAM_ADMIN_CHAT_ID`.
3. Задать оба значения как переменные окружения сервиса на Render (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`) и передеплоить.
4. Готово: сообщения курьеров из приложения будут приходить в этот чат, а Reply на них — уходить обратно курьеру.

## Переменные окружения (`.env`)
```
DATABASE_FILE=./data/dev.db
JWT_SECRET=...
PORT=4000
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
TELEGRAM_BRIDGE_TOKEN=
UPLOAD_DIR=./uploads
LATE_GRACE_MINUTES=15
```
