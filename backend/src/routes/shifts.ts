import { Router } from "express";
import { z } from "zod";
import { eq, desc, and, gte, lt, lte } from "drizzle-orm";
import { db } from "../db/client";
import { shifts, notifications, couriers, samokatHours, hoursEntries, latenessEntries } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import {
  dateKey,
  factHours,
  planHours,
  startOfWeek,
  addDays,
  round1,
  WEEKLY_TARGET_HOURS,
  SHORT_SHIFT_THRESHOLD_HOURS,
} from "../lib/hours";

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
  const checkOutAt = new Date();
  const updated = db
    .update(shifts)
    .set({ checkOutAt, status: "COMPLETED" })
    .where(eq(shifts.id, shift.id))
    .returning()
    .get();

  const worked = factHours({ checkInAt: shift.checkInAt, checkOutAt });
  const isShort = worked > 0 && worked < SHORT_SHIFT_THRESHOLD_HOURS;
  if (isShort) {
    db.insert(notifications)
      .values({
        courierId: req.auth!.id,
        type: "SHORT_SHIFT",
        message: `Смена короче ${SHORT_SHIFT_THRESHOLD_HOURS} часов (${round1(worked)} ч). Пожалуйста, укажите причину в форме обратной связи.`,
      })
      .run();
  }

  res.json({ ...updated, workedHours: round1(worked), isShort });
});

// Курьер: прогресс часов за текущую неделю (цель — 72 ч/нед) + подсветка дней короче 12 ч
shiftsRouter.get("/hours/me", requireAuth("courier"), (req, res) => {
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 7);

  const list = db
    .select()
    .from(shifts)
    .where(
      and(eq(shifts.courierId, req.auth!.id), gte(shifts.scheduledStart, weekStart), lt(shifts.scheduledStart, weekEnd))
    )
    .orderBy(shifts.scheduledStart)
    .all();

  const days = list.map((s) => {
    const fact = round1(factHours(s));
    return {
      shiftId: s.id,
      date: dateKey(s.scheduledStart),
      planHours: round1(planHours(s)),
      factHours: fact,
      status: s.status,
      isShort: s.status === "COMPLETED" && fact > 0 && fact < SHORT_SHIFT_THRESHOLD_HOURS,
    };
  });

  const totalHours = round1(days.reduce((sum, d) => sum + d.factHours, 0));

  res.json({
    weekStart: dateKey(weekStart),
    targetHours: WEEKLY_TARGET_HOURS,
    totalHours,
    progressPct: Math.min(100, Math.round((totalHours / WEEKLY_TARGET_HOURS) * 100)),
    days,
  });
});

// Админ: сверка часов по всем курьерам за период (по умолчанию — текущая неделя).
// Сравнивает наши данные (план/факт по сменам) с данными из HR-платформы (samokat_hours).
shiftsRouter.get("/hours/summary", requireAuth("admin"), (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : startOfWeek(new Date());
  const to = req.query.to ? new Date(String(req.query.to)) : addDays(from, 7);

  const allCouriers = db.select().from(couriers).orderBy(couriers.fullName).all();
  const shiftRows = db
    .select()
    .from(shifts)
    .where(and(gte(shifts.scheduledStart, from), lt(shifts.scheduledStart, to)))
    .all();
  const samokatRows = db.select().from(samokatHours).all();
  const hoursEntryRows = db.select().from(hoursEntries).where(eq(hoursEntries.status, "APPROVED")).all();
  const fromKey = dateKey(from);
  const toKey = dateKey(addDays(to, -1));
  const latenessRows = db
    .select()
    .from(latenessEntries)
    .where(and(gte(latenessEntries.date, fromKey), lte(latenessEntries.date, toKey)))
    .all();

  const dates: string[] = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) dates.push(dateKey(d));

  const result = allCouriers.map((c) => {
    const cShifts = shiftRows.filter((s) => s.courierId === c.id);
    const cSamokat = new Map(
      samokatRows.filter((r) => r.courierId === c.id).map((r) => [r.date, r])
    );
    const cSelfReported = new Map(
      hoursEntryRows.filter((r) => r.courierId === c.id).map((r) => [r.date, r.hours])
    );
    const latenessCount = latenessRows.filter((l) => l.courierId === c.id).length;

    let totalFact = 0;
    const days = dates.map((date) => {
      const shift = cShifts.find((s) => dateKey(s.scheduledStart) === date);
      const fact = shift ? round1(factHours(shift)) : 0;
      const plan = shift ? round1(planHours(shift)) : 0;
      const samokat = cSamokat.get(date);
      const selfReportedHours = cSelfReported.get(date) ?? null;
      totalFact += fact;
      const expected = plan || samokat?.intervalHours || 0;
      const actual = fact || samokat?.confirmedHours || selfReportedHours || 0;
      return {
        date,
        planHours: plan,
        factHours: fact,
        isShort: shift?.status === "COMPLETED" && fact > 0 && fact < SHORT_SHIFT_THRESHOLD_HOURS,
        samokatConfirmedHours: samokat?.confirmedHours ?? null,
        samokatIntervalHours: samokat?.intervalHours ?? null,
        mismatch:
          samokat?.confirmedHours != null && Math.abs((samokat.confirmedHours ?? 0) - fact) > 0.5,
        selfReportedHours,
        noShow: expected > 0 && actual === 0,
      };
    });

    return {
      courierId: c.id,
      fullName: c.fullName,
      phone: c.phone,
      totalFactHours: round1(totalFact),
      latenessCount,
      days,
    };
  });

  res.json({ from: fromKey, to: toKey, dates, couriers: result });
});
