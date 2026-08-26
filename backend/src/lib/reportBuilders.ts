// Общие построители xlsx-отчётов — используются и HTTP-роутом /api/reports, и Telegram-ботом
// (команды /report, /staff), чтобы не дублировать логику формирования таблиц.
import * as XLSX from "xlsx";
import { and, gte, lt } from "drizzle-orm";
import { db } from "../db/client";
import { couriers, payrollEntries, shifts } from "../db/schema";
import { startOfWeek, addDays, dateKey, factHours, round1 } from "./hours";

function toBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// Полный список курьеров с балансом и итогами по реестру
export function buildCouriersWorkbook(): Buffer {
  const all = db.select().from(couriers).orderBy(couriers.fullName).all();
  const entries = db.select().from(payrollEntries).all();

  const rows = all.map((c) => {
    const cEntries = entries.filter((e) => e.courierId === c.id);
    const totalEarned = cEntries.reduce((s, e) => s + e.earnedAmount, 0);
    const totalPaidOut = cEntries.reduce((s, e) => s + e.paidOutAmount, 0);
    return {
      "ФИО": c.fullName,
      "Город": c.city ?? "",
      "Табельный номер": c.personnelNumber ?? "",
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
  return toBuffer(wb);
}

// Лёгкий «актуальный штат» — только активные курьеры, для быстрой выгрузки в Telegram
export function buildActiveStaffWorkbook(): Buffer {
  const active = db
    .select()
    .from(couriers)
    .orderBy(couriers.city, couriers.fullName)
    .all()
    .filter((c) => c.isActive);

  const rows = active.map((c) => ({
    "ФИО": c.fullName,
    "Город": c.city ?? "—",
    "Табельный номер": c.personnelNumber ?? "",
    "Телефон": c.phone,
    "Мед. книжка": c.medBookNumber,
    "Велосипед": c.bikeNumber,
    "С нами с": dateKey(c.createdAt),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Актуальный штат");
  return toBuffer(wb);
}

// План/факт по часам за период (по умолчанию — текущая неделя) — матрица курьер × дата
export function buildHoursWorkbook(from?: Date, to?: Date): Buffer {
  const rangeFrom = from ?? startOfWeek(new Date());
  const rangeTo = to ?? addDays(rangeFrom, 7);

  const allCouriers = db.select().from(couriers).orderBy(couriers.fullName).all();
  const shiftRows = db
    .select()
    .from(shifts)
    .where(and(gte(shifts.scheduledStart, rangeFrom), lt(shifts.scheduledStart, rangeTo)))
    .all();

  const dates: string[] = [];
  for (let d = new Date(rangeFrom); d < rangeTo; d = addDays(d, 1)) dates.push(dateKey(d));

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
  return toBuffer(wb);
}
