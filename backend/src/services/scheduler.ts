// Фоновая проверка смен: если курьер вовремя не отметил выход — уведомление и статус LATE,
// а если смена уже закончилась без отметки — статус NO_SHOW.
// Запускается каждую минуту через node-cron (см. src/index.ts).

import cron from "node-cron";
import { eq, and, isNull, lt, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { shifts, notifications } from "../db/schema";

const LATE_GRACE_MINUTES = Number(process.env.LATE_GRACE_MINUTES || 15);

export function startScheduler() {
  cron.schedule("* * * * *", () => {
    try {
      checkLateShifts();
      checkNoShowShifts();
    } catch (err) {
      console.error("[scheduler] ошибка проверки смен", err);
    }
  });
  console.log(`[scheduler] запущен, льготный период опоздания: ${LATE_GRACE_MINUTES} мин`);
}

export function checkLateShifts() {
  const now = new Date();
  const graceMs = LATE_GRACE_MINUTES * 60 * 1000;

  const candidates = db
    .select()
    .from(shifts)
    .where(and(eq(shifts.status, "PLANNED"), isNull(shifts.checkInAt), isNull(shifts.lateReminderSentAt)))
    .all();

  for (const shift of candidates) {
    if (now.getTime() < shift.scheduledStart.getTime() + graceMs) continue;

    db.update(shifts)
      .set({ status: "LATE", lateReminderSentAt: now })
      .where(eq(shifts.id, shift.id))
      .run();

    db.insert(notifications)
      .values({
        courierId: shift.courierId,
        type: "SHIFT_NOT_STARTED",
        message:
          "Вы не отметили выход на смену вовремя. Отметьтесь в приложении и укажите причину опоздания в форме обратной связи.",
      })
      .run();
  }
}

export function checkNoShowShifts() {
  const now = new Date();

  const candidates = db
    .select()
    .from(shifts)
    .where(and(inArray(shifts.status, ["PLANNED", "LATE"]), isNull(shifts.checkInAt), lt(shifts.scheduledEnd, now)))
    .all();

  for (const shift of candidates) {
    db.update(shifts).set({ status: "NO_SHOW" }).where(eq(shifts.id, shift.id)).run();
    db.insert(notifications)
      .values({
        courierId: shift.courierId,
        type: "SHIFT_NOT_STARTED",
        message: "Смена отмечена как невыход. Пожалуйста, укажите причину в форме обратной связи.",
      })
      .run();
  }
}
