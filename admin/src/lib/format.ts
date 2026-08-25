export function formatMoney(kopecks: number) {
  return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₽";
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU");
}

export const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Запланирована",
  CHECKED_IN: "Отметился вовремя",
  LATE: "Опоздал",
  NO_SHOW: "Не вышел",
  COMPLETED: "Завершена",
  PENDING: "Ожидает оплаты",
  PAID: "Оплачено",
  NEW: "Новое",
  REVIEWED: "Рассмотрено",
};

export const STATUS_COLOR: Record<string, string> = {
  PLANNED: "#6b7280",
  CHECKED_IN: "#16a34a",
  LATE: "#d97706",
  NO_SHOW: "#dc2626",
  COMPLETED: "#2563eb",
  PENDING: "#d97706",
  PAID: "#16a34a",
  NEW: "#d97706",
  REVIEWED: "#16a34a",
};
