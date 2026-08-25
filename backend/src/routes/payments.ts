import { Router } from "express";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/client";
import { payments, couriers, notifications } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const paymentsRouter = Router();

const paymentInput = z.object({
  courierId: z.string(),
  amount: z.number().int().positive(), // в копейках
  periodFrom: z.coerce.date(),
  periodTo: z.coerce.date(),
  note: z.string().optional(),
  markPaid: z.boolean().optional(), // сразу отметить как оплаченную
});

// Админ: выгрузить выплату курьеру
paymentsRouter.post("/", requireAuth("admin"), (req, res) => {
  const parsed = paymentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Проверьте данные выплаты" });
  const { courierId, amount, periodFrom, periodTo, note, markPaid } = parsed.data;

  const payment = db
    .insert(payments)
    .values({
      courierId,
      amount,
      periodFrom,
      periodTo,
      note,
      status: markPaid ? "PAID" : "PENDING",
      paidAt: markPaid ? new Date() : null,
    })
    .returning()
    .get();

  if (markPaid) {
    db.update(couriers)
      .set({ balance: sql`${couriers.balance} + ${amount}` })
      .where(eq(couriers.id, courierId))
      .run();
    db.insert(notifications)
      .values({
        courierId,
        type: "PAYMENT_RECEIVED",
        message: `Вам выплачено ${(amount / 100).toFixed(2)} за период.`,
      })
      .run();
  }

  res.status(201).json(payment);
});

// Админ: отметить выплату как выполненную
paymentsRouter.patch("/:id/mark-paid", requireAuth("admin"), (req, res) => {
  const payment = db.select().from(payments).where(eq(payments.id, req.params.id)).get();
  if (!payment) return res.status(404).json({ error: "Выплата не найдена" });
  if (payment.status === "PAID") return res.status(409).json({ error: "Уже оплачено" });

  const updated = db
    .update(payments)
    .set({ status: "PAID", paidAt: new Date() })
    .where(eq(payments.id, payment.id))
    .returning()
    .get();

  db.update(couriers)
    .set({ balance: sql`${couriers.balance} + ${payment.amount}` })
    .where(eq(couriers.id, payment.courierId))
    .run();
  db.insert(notifications)
    .values({
      courierId: payment.courierId,
      type: "PAYMENT_RECEIVED",
      message: `Вам выплачено ${(payment.amount / 100).toFixed(2)} за период.`,
    })
    .run();

  res.json(updated);
});

// Курьер: мои выплаты + баланс
paymentsRouter.get("/me", requireAuth("courier"), (req, res) => {
  const list = db
    .select()
    .from(payments)
    .where(eq(payments.courierId, req.auth!.id))
    .orderBy(desc(payments.createdAt))
    .all();
  const courier = db.select().from(couriers).where(eq(couriers.id, req.auth!.id)).get();
  res.json({ balance: courier?.balance ?? 0, payments: list });
});

// Админ: выплаты с фильтром по курьеру
paymentsRouter.get("/", requireAuth("admin"), (req, res) => {
  const courierId = req.query.courierId as string | undefined;
  const list = courierId
    ? db.select().from(payments).where(eq(payments.courierId, courierId)).orderBy(desc(payments.createdAt)).all()
    : db.select().from(payments).orderBy(desc(payments.createdAt)).limit(200).all();
  res.json(list);
});
