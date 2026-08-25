// Схема данных курьерской платформы (Drizzle ORM, SQLite для разработки).
// Для продакшена см. docs/DEPLOY.md — переезд на Postgres меняет только db/client.ts.

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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

// type: SHIFT_REMINDER | SHIFT_NOT_STARTED | PAYMENT_RECEIVED | CHAT_REPLY | GENERIC
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
