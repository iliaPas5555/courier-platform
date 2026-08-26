// Простая идемпотентная миграция (CREATE TABLE IF NOT EXISTS) — без drizzle-kit,
// чтобы не зависеть от загрузки внешних бинарников в песочнице.
// Запуск: npm run db:migrate

import { sqlite } from "./client";

sqlite.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS couriers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  photo_url TEXT,
  med_book_number TEXT NOT NULL,
  bike_number TEXT NOT NULL,
  city TEXT,
  personnel_number TEXT,
  telegram_chat_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  scheduled_start INTEGER NOT NULL,
  scheduled_end INTEGER NOT NULL,
  check_in_at INTEGER,
  check_out_at INTEGER,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  late_reminder_sent_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_shifts_courier_start ON shifts(courier_id, scheduled_start);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  period_from INTEGER NOT NULL,
  period_to INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  paid_at INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_payments_courier ON payments(courier_id);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  earned_amount INTEGER NOT NULL,
  held_amount INTEGER NOT NULL,
  paid_out_amount INTEGER NOT NULL DEFAULT 0,
  batch_id TEXT NOT NULL,
  source_file_name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_payroll_courier_created ON payroll_entries(courier_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payroll_batch ON payroll_entries(batch_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  text TEXT,
  media_urls TEXT NOT NULL DEFAULT '[]',
  telegram_message_id TEXT,
  read_by_admin INTEGER NOT NULL DEFAULT 0,
  read_by_courier INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_chat_courier_created ON chat_messages(courier_id, created_at);

CREATE TABLE IF NOT EXISTS feedback_reports (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  media_urls TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'NEW',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_feedback_courier_created ON feedback_reports(courier_id, created_at);

CREATE TABLE IF NOT EXISTS profile_change_requests (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  changes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_profile_requests_status ON profile_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_requests_courier ON profile_change_requests(courier_id);

CREATE TABLE IF NOT EXISTS samokat_hours (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  interval_hours REAL,
  confirmed_hours REAL,
  confirmation_pct INTEGER,
  imported_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_samokat_hours_courier_date ON samokat_hours(courier_id, date);

CREATE TABLE IF NOT EXISTS hours_entries (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  hours REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  admin_note TEXT,
  submitted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  reviewed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hours_entries_courier_date ON hours_entries(courier_id, date);
CREATE INDEX IF NOT EXISTS idx_hours_entries_status ON hours_entries(status);

CREATE TABLE IF NOT EXISTS lateness_entries (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_lateness_courier ON lateness_entries(courier_id);
CREATE INDEX IF NOT EXISTS idx_lateness_date ON lateness_entries(date);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  courier_id TEXT NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notifications_courier_sent ON notifications(courier_id, sent_at);
`);

// Идемпотентные ALTER TABLE для колонок, добавленных ПОСЛЕ первого релиза таблицы —
// на уже существующей базе CREATE TABLE IF NOT EXISTS их не добавит.
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    console.log(`Добавлена колонка ${table}.${column}`);
  }
}

ensureColumn("couriers", "city", "city TEXT");
ensureColumn("couriers", "personnel_number", "personnel_number TEXT");
ensureColumn("hours_entries", "period_start", "period_start TEXT");
ensureColumn("hours_entries", "period_end", "period_end TEXT");

console.log("Миграция выполнена, таблицы готовы.");
