import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { shifts } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const shiftsRouter = Router();

const shiftInput = z.object({
  courierId: z.string(),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
});

// Админ: выгрузить расписание — один или несколько курьеров сразу.
// Тело: { shifts: [{ courierId, scheduledStart, scheduledEnd }, ...] }
shiftsRouter.post("/", requireAuth("admin"), (req, res) => {
  const parsed = z.object({ shifts: z.array(shiftInput).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Проверьте формат расписания", details: parsed.error.issues });
  }

  const created = parsed.data.shifts.map((s) =>
    db
      .insert(shifts)
      .values({ courierId: s.courierId, scheduledStart: s.scheduledStart, scheduledEnd: s.scheduledEnd })
      .returning()
      .get()
  );

  res.status(201).json(created);
});

shiftsRouter.delete("/:id", requireAuth("admin"), (req, res) => {
  db.delete(shifts).where(eq(shifts.id, req.params.id)).run();
  res.status(204).end();
});

// Курьер: мои смены (ближайшие и прошедшие)
shiftsRouter.get("/me", requireAuth("courier"), (req, res) => {
  const list = db
    .select()
    .from(shifts)
    .where(eq(shifts.courierId, req.auth!.id))
    .orderBy(desc(shifts.scheduledStart))
    .limit(60)
    .all();
  res.json(list);
});

// Админ: смены с фильтром по курьеру
shiftsRouter.get("/", requireAuth("admin"), (req, res) => {
  const courierId = req.query.courierId as string | undefined;
  const list = courierId
    ? db.select().from(shifts).where(eq(shifts.courierId, courierId)).orderBy(desc(shifts.scheduledStart)).all()
    : db.select().from(shifts).orderBy(desc(shifts.scheduledStart)).limit(200).all();
  res.json(list);
});

const LATE_GRACE_MINUTES = Number(process.env.LATE_GRACE_MINUTES || 15);

// Курьер отмечает выход на смену
shiftsRouter.post("/:id/check-in", requireAuth("courier"), (req, res) => {
  const shift = db.select().from(shifts).where(eq(shifts.id, req.params.id)).get();
  if (!shift || shift.courierId !== req.auth!.id) {
    return res.status(404).json({ error: "Смена не найдена" });
  }
  if (shift.checkInAt) {
    return res.status(409).json({ error: "Выход уже отмечен" });
  }

  const now = new Date();
  const graceMs = LATE_GRACE_MINUTES * 60 * 1000;
  const isLate = now.getTime() > shift.scheduledStart.getTime() + graceMs;

  const updated = db
    .update(shifts)
    .set({ checkInAt: now, status: isLate ? "LATE" : "CHECKED_IN" })
    .where(eq(shifts.id, shift.id))
    .returning()
    .get();

  res.json({ shift: updated, isLate });
});

// Курьер отмечает окончание смены
shiftsRouter.post("/:id/check-out", requireAuth("courier"), (req, res) => {
  const shift = db.select().from(shifts).where(eq(shifts.id, req.params.id)).get();
  if (!shift || shift.courierId !== req.auth!.id) {
    return res.status(404).json({ error: "Смена не найдена" });
  }
  if (!shift.checkInAt) {
    return res.status(409).json({ error: "Сначала отметьте выход на смену" });
  }
  const updated = db
    .update(shifts)
    .set({ checkOutAt: new Date(), status: "COMPLETED" })
    .where(eq(shifts.id, shift.id))
    .returning()
    .get();
  res.json(updated);
});
