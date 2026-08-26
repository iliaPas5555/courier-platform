// Схема данных курьерской платформы (Drizzle ORM, SQLite для разработки).
// Для продакшена см. docs/DEPLOY.md — переезд на Postgres меняет только db/client.ts.

import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

export const admins = sqliteTable("admins", {
  id: id(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const couriers = sqliteTable("couriers", {
  id: id(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  photoUrl: text("photo_url"),
  medBookNumber: text("med_book_number").notNull(),
  bikeNumber: text("bike_number").notNull(),
  city: text("city"), // 'МСК' | 'СПБ'
  personnelNumber: text("personnel_number"), // табельный номер — вносится админом
  telegramChatId: text("telegram_chat_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  balance: integer("balance").notNull().default(0), // в копейках
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// PLANNED | CHECKED_IN | LATE | NO_SHOW | COMPLETED
export const shifts = sqliteTable("shifts", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  scheduledStart: integer("scheduled_start", { mode: "timestamp" }).notNull(),
  scheduledEnd: integer("scheduled_end", { mode: "timestamp" }).notNull(),
  checkInAt: integer("check_in_at", { mode: "timestamp" }),
  checkOutAt: integer("check_out_at", { mode: "timestamp" }),
  status: text("status").notNull().default("PLANNED"),
  lateReminderSentAt: integer("late_reminder_sent_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

// PENDING | PAID
export const payments = sqliteTable("payments", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // в копейках
  periodFrom: integer("period_from", { mode: "timestamp" }).notNull(),
  periodTo: integer("period_to", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("PENDING"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  note: text("note"),
  createdAt: createdAt(),
});

// Начисления из еженедельного реестра (загружается админом файлом .xlsx).
// earnedAmount — заработано за период; heldAmount — удержано и добавлено к балансу
// курьера (баланс = сумма всех heldAmount, пока не будет реестра финального расчёта);
// paidOutAmount — выдано на руки в этот период (уже не в балансе, только для истории).
export const payrollEntries = sqliteTable("payroll_entries", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // как указано в реестре, напр. "17-23.08"
  earnedAmount: integer("earned_amount").notNull(), // копейки
  heldAmount: integer("held_amount").notNull(), // копейки, добавляется к courier.balance
  paidOutAmount: integer("paid_out_amount").notNull().default(0), // копейки
  batchId: text("batch_id").notNull(), // группирует записи одной загрузки реестра
  sourceFileName: text("source_file_name"),
  createdAt: createdAt(),
});

// senderType: COURIER | ADMIN
export const chatMessages = sqliteTable("chat_messages", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(),
  text: text("text"),
  mediaUrls: text("media_urls").notNull().default("[]"), // JSON-массив
  telegramMessageId: text("telegram_message_id"),
  readByAdmin: integer("read_by_admin", { mode: "boolean" }).notNull().default(false),
  readByCourier: integer("read_by_courier", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

// type: LATE | NO_SHOW | OTHER ; status: NEW | REVIEWED
export const feedbackReports = sqliteTable("feedback_reports", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  shiftId: text("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  reason: text("reason").notNull(),
  mediaUrls: text("media_urls").notNull().default("[]"),
  status: text("status").notNull().default("NEW"),
  createdAt: createdAt(),
});

// Заявка курьера на изменение анкетных данных — применяется только после одобрения админом.
// changes — JSON-объект с предложенными полями: fullName/phone/medBookNumber/bikeNumber/photoUrl.
// status: PENDING | APPROVED | REJECTED
export const profileChangeRequests = sqliteTable("profile_change_requests", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  changes: text("changes").notNull(),
  status: text("status").notNull().default("PENDING"),
  adminNote: text("admin_note"),
  createdAt: createdAt(),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
});

// Часы курьера, импортированные с HR-платформы (hiring.samokat.ru) — для сверки с нашими
// данными по сменам. intervalHours — «Интервалы», confirmedHours — «Подтв. часы»,
// confirmationPct — «% подтверждения» (null, если «–»). Уникально по (courierId, date).
export const samokatHours = sqliteTable(
  "samokat_hours",
  {
    id: id(),
    courierId: text("courier_id")
      .notNull()
      .references(() => couriers.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // 'YYYY-MM-DD'
    intervalHours: real("interval_hours"),
    confirmedHours: real("confirmed_hours"),
    confirmationPct: integer("confirmation_pct"),
    importedAt: integer("imported_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    courierDate: uniqueIndex("idx_samokat_hours_courier_date").on(t.courierId, t.date),
  })
);

// Курьер сам проставляет период смены (с — по) за день (например, за неделю разом) —
// часы считает система; в сверку и статистику попадают только после одобрения админом.
// status: PENDING | APPROVED | REJECTED
export const hoursEntries = sqliteTable(
  "hours_entries",
  {
    id: id(),
    courierId: text("courier_id")
      .notNull()
      .references(() => couriers.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // 'YYYY-MM-DD'
    periodStart: text("period_start"), // 'HH:MM'
    periodEnd: text("period_end"), // 'HH:MM'
    hours: real("hours").notNull(), // считается сервером из periodStart/periodEnd
    status: text("status").notNull().default("PENDING"),
    adminNote: text("admin_note"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  },
  (t) => ({
    courierDate: uniqueIndex("idx_hours_entries_courier_date").on(t.courierId, t.date),
  })
);

// Ручная фиксация опозданий администратором — для статистики по курьерам (страница «Опоздания»).
export const latenessEntries = sqliteTable("lateness_entries", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // 'YYYY-MM-DD'
  note: text("note"),
  createdAt: createdAt(),
});

// type: SHIFT_REMINDER | SHIFT_NOT_STARTED | PAYMENT_RECEIVED | CHAT_REPLY | GENERIC | SHORT_SHIFT | PROFILE_REQUEST | HOURS_ENTRY
export const notifications = sqliteTable("notifications", {
  id: id(),
  courierId: text("courier_id")
    .notNull()
    .references(() => couriers.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  readAt: integer("read_at", { mode: "timestamp" }),
});
