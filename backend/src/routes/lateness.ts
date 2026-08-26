// Ручная фиксация опозданий администратором — не привязана к автоматическим отметкам
// смены, нужна для ведения статистики по курьерам (страница «Опоздания» в админке).
import { Router } from "express";
import { z } from "zod";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db } from "../db/client";
import { latenessEntries, couriers } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const latenessRouter = Router();

// Админ: создать запись об опоздании
latenessRouter.post("/", requireAuth("admin"), (req, res) => {
  const parsed = z
    .object({
      courierId: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
      note: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Проверьте поля", details: parsed.error.issues });
  }

  const courier = db.select().from(couriers).where(eq(couriers.id, parsed.data.courierId)).get();
  if (!courier) return res.status(404).json({ error: "Курьер не найден" });

  const entry = db
    .insert(latenessEntries)
    .values({ courierId: parsed.data.courierId, date: parsed.data.date, note: parsed.data.note?.trim() || null })
    .returning()
    .get();

  res.status(201).json(entry);
});

// Админ: список опозданий (фильтр по курьеру и/или периоду) + статистика по курьерам
latenessRouter.get("/", requireAuth("admin"), (req, res) => {
  const courierId = req.query.courierId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  const conditions = [
    courierId ? eq(latenessEntries.courierId, courierId) : undefined,
    from ? gte(latenessEntries.date, from) : undefined,
    to ? lte(latenessEntries.date, to) : undefined,
  ].filter((c): c is NonNullable<typeof c> => Boolean(c));

  const list = conditions.length
    ? db
        .select()
        .from(latenessEntries)
        .where(and(...conditions))
        .orderBy(desc(latenessEntries.date))
        .all()
    : db.select().from(latenessEntries).orderBy(desc(latenessEntries.date)).all();

  const allCouriers = db.select().from(couriers).all();
  const byId = new Map(allCouriers.map((c) => [c.id, c]));

  const countByCourier = new Map<string, number>();
  for (const e of list) countByCourier.set(e.courierId, (countByCourier.get(e.courierId) ?? 0) + 1);

  const stats = [...countByCourier.entries()]
    .map(([id, count]) => ({ courierId: id, fullName: byId.get(id)?.fullName ?? "—", count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    entries: list.map((e) => ({ ...e, courier: byId.get(e.courierId) ? { id: e.courierId, fullName: byId.get(e.courierId)!.fullName } : null })),
    stats,
  });
});

// Админ: удалить запись (ошиблись при ручном вводе)
latenessRouter.delete("/:id", requireAuth("admin"), (req, res) => {
  db.delete(latenessEntries).where(eq(latenessEntries.id, req.params.id)).run();
  res.status(204).end();
});
