// Экспорт отчётов из админ-панели в .xlsx.
import { Router } from "express";
import * as XLSX from "xlsx";
import { desc } from "drizzle-orm";
import { db } from "../db/client";
import { couriers, payrollEntries } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { startOfWeek, addDays, dateKey, factHours, planHours, round1 } from "../lib/hours";
import { shifts, samokatHours } from "../db/schema";
import { and, gte, lt } from "drizzle-orm";

export const reportsRouter = Router();

function sendWorkbook(res: import("express").Response, wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
}

// Админ: список курьеров с балансом и итогами по реестру — одним файлом
reportsRouter.get("/couriers.xlsx", requireAuth("admin"), (_req, res) => {
  const all = db.select().from(couriers).orderBy(couriers.fullName).all();
  const entries = db.select().from(payrollEntries).all();

  const rows = all.map((c) => {
    const cEntries = entries.filter((e) => e.courierId === c.id);
    const totalEarned = cEntries.reduce((s, e) => s + e.earnedAmount, 0);
    const totalPaidOut = cEntries.reduce((s, e) => s + e.paidOutAmount, 0);
    return {
      "ФИО": c.fullName,
      "Телефон": c.phone,
      "Мед. книжка": c.medBookNumber,
      "Велосипед": c.bikeNumber,
      "Баланс (удержано), ₽": c.balance / 100,
      "Заработано всего, ₽": totalEarned / 100,
      "Выдано на руки всего, ₽": totalPaidOut / 100,
      "Активен": c.isActive ? "да" : "нет",
      "С нами с": dateKey(c.createdAt),
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Курьеры");
  sendWorkbook(res, wb, `courier-platform-couriers-${dateKey(new Date())}.xlsx`);
});

// Админ: план/факт по часам за период (по умолчанию — текущая неделя) — матрица курьер × дата
reportsRouter.get("/hours.xlsx", requireAuth("admin"), (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : startOfWeek(new Date());
  const to = req.query.to ? new Date(String(req.query.to)) : addDays(from, 7);

  const allCouriers = db.select().from(couriers).orderBy(couriers.fullName).all();
  const shiftRows = db
    .select()
    .from(shifts)
    .where(and(gte(shifts.scheduledStart, from), lt(shifts.scheduledStart, to)))
    .all();
  const samokatRows = db.select().from(samokatHours).all();

  const dates: string[] = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) dates.push(dateKey(d));

  const rows = allCouriers.map((c) => {
    const cShifts = shiftRows.filter((s) => s.courierId === c.id);
    const row: Record<string, string | number> = { "ФИО": c.fullName, "Телефон": c.phone };
    let total = 0;
    for (const date of dates) {
      const shift = cShifts.find((s) => dateKey(s.scheduledStart) === date);
      const fact = shift ? round1(factHours(shift)) : 0;
      total += fact;
      row[date] = fact || "";
    }
    row["Итого, ч"] = round1(total);
    return row;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Часы (факт)");
  sendWorkbook(res, wb, `courier-platform-hours-${dateKey(from)}-${dateKey(addDays(to, -1))}.xlsx`);
});
