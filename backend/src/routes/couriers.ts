import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { couriers, shifts, payments, feedbackReports, payrollEntries } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const couriersRouter = Router();

function stripSecret<T extends { passwordHash?: unknown }>(c: T) {
  const { passwordHash, ...rest } = c;
  return rest;
}

// Курьер смотрит свой профиль
couriersRouter.get("/me", requireAuth("courier"), (req, res) => {
  const courier = db.select().from(couriers).where(eq(couriers.id, req.auth!.id)).get();
  if (!courier) return res.status(404).json({ error: "Курьер не найден" });
  res.json(stripSecret(courier));
});

// Админ: список всех курьеров
couriersRouter.get("/", requireAuth("admin"), (_req, res) => {
  const list = db.select().from(couriers).orderBy(desc(couriers.createdAt)).all();
  res.json(list.map(stripSecret));
});

// Админ: полная карточка курьера — профиль + последние смены/выплаты/обращения
couriersRouter.get("/:id", requireAuth("admin"), (req, res) => {
  const courier = db.select().from(couriers).where(eq(couriers.id, req.params.id)).get();
  if (!courier) return res.status(404).json({ error: "Курьер не найден" });

  const recentShifts = db
    .select()
    .from(shifts)
    .where(eq(shifts.courierId, req.params.id))
    .orderBy(desc(shifts.scheduledStart))
    .limit(30)
    .all();
  const recentPayments = db
    .select()
    .from(payments)
    .where(eq(payments.courierId, req.params.id))
    .orderBy(desc(payments.createdAt))
    .limit(30)
    .all();
  const recentFeedback = db
    .select()
    .from(feedbackReports)
    .where(eq(feedbackReports.courierId, req.params.id))
    .orderBy(desc(feedbackReports.createdAt))
    .limit(30)
    .all();
  const recentPayroll = db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.courierId, req.params.id))
    .orderBy(desc(payrollEntries.createdAt))
    .limit(50)
    .all();

  res.json({
    courier: stripSecret(courier),
    shifts: recentShifts,
    payments: recentPayments,
    feedback: recentFeedback,
    payroll: recentPayroll,
  });
});
