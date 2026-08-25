# API курьерской платформы

Базовый URL (разработка): `http://localhost:4000`

Авторизация — JWT в заголовке `Authorization: Bearer <token>`. Роли: `courier`, `admin`.

## Auth
- `POST /auth/courier/register` — multipart form: fullName, phone, password, medBookNumber, bikeNumber, photo (файл, опционально)
- `POST /auth/courier/login` — { phone, password }
- `POST /auth/admin/login` — { phone, password } (админов создаёт `npm run db:seed`)

## Курьеры
- `GET /couriers/me` (courier) — свой профиль
- `GET /couriers` (admin) — список всех курьеров
- `GET /couriers/:id` (admin) — карточка курьера + последние смены/выплаты/обращения

## Смены
- `POST /shifts` (admin) — { shifts: [{ courierId, scheduledStart, scheduledEnd }, ...] } — выгрузка расписания
- `DELETE /shifts/:id` (admin)
- `GET /shifts/me` (courier)
- `GET /shifts?courierId=` (admin)
- `POST /shifts/:id/check-in` (courier) — отметить выход (LATE, если позже scheduledStart + LATE_GRACE_MINUTES)
- `POST /shifts/:id/check-out` (courier)

## Выплаты
- `POST /payments` (admin) — { courierId, amount (в копейках), periodFrom, periodTo, note?, markPaid? }
- `PATCH /payments/:id/mark-paid` (admin)
- `GET /payments/me` (courier) — { balance, payments }
- `GET /payments?courierId=` (admin)

## Чат
- `GET /chat/me` / `POST /chat/me` (courier, multipart: text?, media[] до 5 файлов) — пересылается в Telegram админу
- `GET /chat` (admin) — список диалогов с непрочитанными
- `GET /chat/:courierId` / `POST /chat/:courierId` (admin, multipart: text?, media[])
- `POST /chat/internal/from-telegram` — служебный эндпоинт для telegram-bot сервиса (заголовок X-Service-Token)

## Обратная связь (опоздание/невыход)
- `POST /feedback` (courier, multipart: type=LATE|NO_SHOW|OTHER, reason, shiftId?, media[])
- `GET /feedback/me` (courier)
- `GET /feedback?courierId=` (admin)
- `PATCH /feedback/:id/reviewed` (admin)

## Уведомления
- `GET /notifications/me` (courier)
- `GET /notifications/me/unread-count` (courier)
- `PATCH /notifications/:id/read` (courier)

## Фоновая логика
`src/services/scheduler.ts` каждую минуту проверяет смены:
- если прошло больше `LATE_GRACE_MINUTES` (по умолчанию 15) от начала смены, а чек-ина нет — статус `LATE` + уведомление курьеру;
- если смена уже закончилась, а чек-ина так и не было — статус `NO_SHOW` + уведомление.

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
