// Курьер сам проставляет отработанные часы за дни текущей недели («табель») — это
// отдельный источник данных от отметок выхода/окончания смены. Применяется в сверке
// и статистике только после одобрения админом.
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { hoursEntries, couriers, notifications } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { startOfWeek, addDays, dateKey, hoursBetween } from "../lib/hours";

export const hoursEntriesRouter = Router();

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
  periodStart: z.string().regex(TIME_RE, "Время в формате ЧЧ:ММ"),
  periodEnd: z.string().regex(TIME_RE, "Время в формате ЧЧ:ММ"),
});

// Курьер: проставить/обновить период смены (с — по) за один или несколько дней (обычно —
// за неделю разом). Часы считает сервер. Повторная отправка по той же дате (в т.ч. уже
// одобренной) снова уводит запись в PENDING.
hoursEntriesRouter.post("/", requireAuth("courier"), (req, res) => {
  const parsed = z.object({ days: z.array(dayInput).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Проверьте формат периода", details: parsed.error.issues });
  }

  const saved = parsed.data.days.map((day) => {
    const hours = hoursBetween(day.periodStart, day.periodEnd);
    const existing = db
      .select()
      .from(hoursEntries)
      .where(and(eq(hoursEntries.courierId, req.auth!.id), eq(hoursEntries.date, day.date)))
      .get();

    if (existing) {
      return db
        .update(hoursEntries)
        .set({
          periodStart: day.periodStart,
          periodEnd: day.periodEnd,
          hours,
          status: "PENDING",
          adminNote: null,
          reviewedAt: null,
          submittedAt: new Date(),
        })
        .where(eq(hoursEntries.id, existing.id))
        .returning()
        .get();
    }
    return db
      .insert(hoursEntries)
      .values({ courierId: req.auth!.id, date: day.date, periodStart: day.periodStart, periodEnd: day.periodEnd, hours })
      .returning()
      .get();
  });

  res.status(201).json(saved);
});

// Курьер: мои часы за текущую неделю
hoursEntriesRouter.get("/me", requireAuth("courier"), (req, res) => {
  const weekStart = startOfWeek(new Date());
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) dates.push(dateKey(addDays(weekStart, i)));

  const list = db.select().from(hoursEntries).where(eq(hoursEntries.courierId, req.auth!.id)).all();
  const byDate = new Map(list.map((e) => [e.date, e]));

  res.json({
    weekStart: dateKey(weekStart),
    days: dates.map(
      (date) => byDate.get(date) ?? { date, periodStart: null, periodEnd: null, hours: null, status: null }
    ),
  });
});

// Админ: список записей (по умолчанию — только PENDING)
hoursEntriesRouter.get("/", requireAuth("admin"), (req, res) => {
  const status = (req.query.status as string | undefined) || "PENDING";
  const list =
    status === "ALL"
      ? db.select().from(hoursEntries).orderBy(desc(hoursEntries.date)).all()
      : db.select().from(hoursEntries).where(eq(hoursEntries.status, status)).orderBy(desc(hoursEntries.date)).all();

  const courierIds = [...new Set(list.map((r) => r.courierId))];
  const allCouriers = courierIds.length
    ? db.select().from(couriers).all().filter((c) => courierIds.includes(c.id))
    : [];
  const byId = new Map(allCouriers.map((c) => [c.id, c]));

  res.json(
    list.map((r) => ({
      ...r,
      courier: byId.get(r.courierId)
        ? { id: byId.get(r.courierId)!.id, fullName: byId.get(r.courierId)!.fullName, phone: byId.get(r.courierId)!.phone }
        : null,
    }))
  );
});

// Админ: одобрить одну запись
hoursEntriesRouter.patch("/:id/approve", requireAuth("admin"), (req, res) => {
  const entry = db.select().from(hoursEntries).where(eq(hoursEntries.id, req.params.id)).get();
  if (!entry) return res.status(404).json({ error: "Запись не найдена" });
  if (entry.status !== "PENDING") return res.status(409).json({ error: "Запись уже рассмотрена" });

  const updated = db
    .update(hoursEntries)
    .set({ status: "APPROVED", reviewedAt: new Date() })
    .where(eq(hoursEntries.id, entry.id))
    .returning()
    .get();

  db.insert(notifications)
    .values({
      courierId: entry.courierId,
      type: "HOURS_ENTRY",
      message: `Часы за ${entry.date} (${entry.hours} ч) подтверждены`,
    })
    .run();

  res.json(updated);
});

// Админ: отклонить одну запись
hoursEntriesRouter.patch("/:id/reject", requireAuth("admin"), (req, res) => {
  const entry = db.select().from(hoursEntries).where(eq(hoursEntries.id, req.params.id)).get();
  if (!entry) return res.status(404).json({ error: "Запись не найдена" });
  if (entry.status !== "PENDING") return res.status(409).json({ error: "Запись уже рассмотрена" });

  const note = (req.body?.note as string | undefined)?.trim() || null;
  const updated = db
    .update(hoursEntries)
    .set({ status: "REJECTED", adminNote: note, reviewedAt: new Date() })
    .where(eq(hoursEntries.id, entry.id))
    .returning()
    .get();

  db.insert(notifications)
    .values({
      courierId: entry.courierId,
      type: "HOURS_ENTRY",
      message: `Часы за ${entry.date} (${entry.hours} ч) отклонены${note ? `: ${note}` : ""}`,
    })
    .run();

  res.json(updated);
});

// Админ: одобрить сразу несколько записей (например, всю неделю курьера одной кнопкой)
hoursEntriesRouter.post("/approve-bulk", requireAuth("admin"), (req, res) => {
  const parsed = z.object({ ids: z.array(z.string()).min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Нужен непустой список ids" });

  const rows = db
    .select()
    .from(hoursEntries)
    .where(and(inArray(hoursEntries.id, parsed.data.ids), eq(hoursEntries.status, "PENDING")))
    .all();

  for (const row of rows) {
    db.update(hoursEntries).set({ status: "APPROVED", reviewedAt: new Date() }).where(eq(hoursEntries.id, row.id)).run();
    db.insert(notifications)
      .values({ courierId: row.courierId, type: "HOURS_ENTRY", message: `Часы за ${row.date} (${row.hours} ч) подтверждены` })
      .run();
  }

  res.json({ approved: rows.length });
});
