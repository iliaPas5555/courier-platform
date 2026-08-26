// Импорт часов с HR-платформы (hiring.samokat.ru). Данные туда попадают через
// браузер-автоматизацию (см. docs/SAMOKAT_SYNC.md) — этот роут просто принимает
// уже прочитанные со страницы строки и сохраняет их для сверки.
import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client";
import { couriers, samokatHours } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const samokatRouter = Router();

function normalizePhone(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "").slice(-10);
}

const rowSchema = z.object({
  phone: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
  intervalHours: z.number().nullable().optional(),
  confirmedHours: z.number().nullable().optional(),
  confirmationPct: z.number().nullable().optional(),
});

// Админ / сервисный вызов: загрузить строки часов с HR-платформы (upsert по курьеру+дате)
samokatRouter.post("/import", requireAuth("admin"), (req, res) => {
  const parsed = z.object({ rows: z.array(rowSchema).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Неверный формат данных", details: parsed.error.issues });
  }

  const allCouriers = db.select().from(couriers).all();
  const byPhone = new Map(allCouriers.map((c) => [normalizePhone(c.phone), c]));

  let matched = 0;
  const unmatched: { phone: string; date: string }[] = [];

  for (const row of parsed.data.rows) {
    const courier = byPhone.get(normalizePhone(row.phone));
    if (!courier) {
      unmatched.push({ phone: row.phone, date: row.date });
      continue;
    }

    const existing = db
      .select()
      .from(samokatHours)
      .where(and(eq(samokatHours.courierId, courier.id), eq(samokatHours.date, row.date)))
      .get();

    if (existing) {
      db.update(samokatHours)
        .set({
          intervalHours: row.intervalHours ?? null,
          confirmedHours: row.confirmedHours ?? null,
          confirmationPct: row.confirmationPct ?? null,
          importedAt: new Date(),
        })
        .where(eq(samokatHours.id, existing.id))
        .run();
    } else {
      db.insert(samokatHours)
        .values({
          courierId: courier.id,
          date: row.date,
          intervalHours: row.intervalHours ?? null,
          confirmedHours: row.confirmedHours ?? null,
          confirmationPct: row.confirmationPct ?? null,
        })
        .run();
    }
    matched++;
  }

  res.json({ matched, unmatchedCount: unmatched.length, unmatched });
});
