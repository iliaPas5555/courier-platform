// Общие хелперы для расчёта часов по сменам — используются и в /shifts (прогресс курьера,
// подсветка коротких смен), и в /reports (сверка план/факт, экспорт).

export const WEEKLY_TARGET_HOURS = 72;
export const SHORT_SHIFT_THRESHOLD_HOURS = 12;

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export function factHours(shift: { checkInAt: Date | null; checkOutAt: Date | null }): number {
  if (!shift.checkInAt || !shift.checkOutAt) return 0;
  return Math.max(0, (shift.checkOutAt.getTime() - shift.checkInAt.getTime()) / 3600000);
}

export function planHours(shift: { scheduledStart: Date; scheduledEnd: Date }): number {
  return Math.max(0, (shift.scheduledEnd.getTime() - shift.scheduledStart.getTime()) / 3600000);
}

// Начало текущей недели (понедельник, 00:00 UTC)
export function startOfWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0 = воскресенье
  const diff = (day === 0 ? -6 : 1) - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Часы между двумя отметками времени 'HH:MM' одного дня. Если конец не позже начала —
// считаем, что смена ушла за полночь (конец на следующий день).
export function hoursBetween(periodStart: string, periodEnd: string): number {
  const [sh, sm] = periodStart.split(":").map(Number);
  const [eh, em] = periodEnd.split(":").map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return round1((endMin - startMin) / 60);
}
