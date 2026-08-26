// Экспорт отчётов из админ-панели в .xlsx. Сами таблицы строятся в lib/reportBuilders —
// тем же кодом пользуется и Telegram-бот (команды /report, /staff).
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { startOfWeek, addDays, dateKey } from "../lib/hours";
import { buildCouriersWorkbook, buildHoursWorkbook } from "../lib/reportBuilders";

export const reportsRouter = Router();

function sendBuffer(res: import("express").Response, buf: Buffer, filename: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
}

// Админ: список курьеров с балансом и итогами по реестру — одним файлом
reportsRouter.get("/couriers.xlsx", requireAuth("admin"), (_req, res) => {
  sendBuffer(res, buildCouriersWorkbook(), `courier-platform-couriers-${dateKey(new Date())}.xlsx`);
});

// Админ: план/факт по часам за период (по умолчанию — текущая неделя) — матрица курьер × дата
reportsRouter.get("/hours.xlsx", requireAuth("admin"), (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : startOfWeek(new Date());
  const to = req.query.to ? new Date(String(req.query.to)) : addDays(from, 7);
  sendBuffer(res, buildHoursWorkbook(from, to), `courier-platform-hours-${dateKey(from)}-${dateKey(addDays(to, -1))}.xlsx`);
});
