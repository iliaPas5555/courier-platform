const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function getToken() {
  return localStorage.getItem("admin_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("admin_token", token);
  else localStorage.removeItem("admin_token");
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new ApiError(data.error || "Ошибка запроса", res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body instanceof FormData ? body : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export { API_BASE };

// Скачать файл (xlsx-отчёты) с авторизацией — обычный fetch не подставляет заголовок сам.
export async function downloadFile(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Не удалось скачать файл");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Типы ----
export interface Courier {
  id: string;
  fullName: string;
  phone: string;
  photoUrl: string | null;
  medBookNumber: string;
  bikeNumber: string;
  isActive: boolean;
  balance: number;
  createdAt: string;
}

export interface Shift {
  id: string;
  courierId: string;
  scheduledStart: string;
  scheduledEnd: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: "PLANNED" | "CHECKED_IN" | "LATE" | "NO_SHOW" | "COMPLETED";
}

export interface Payment {
  id: string;
  courierId: string;
  amount: number;
  periodFrom: string;
  periodTo: string;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  note: string | null;
}

export interface FeedbackReport {
  id: string;
  courierId: string;
  shiftId: string | null;
  type: "LATE" | "NO_SHOW" | "OTHER";
  reason: string;
  mediaUrls: string[];
  status: "NEW" | "REVIEWED";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  courierId: string;
  senderType: "COURIER" | "ADMIN";
  text: string | null;
  mediaUrls: string[];
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  courierId: string;
  period: string;
  earnedAmount: number;
  heldAmount: number;
  paidOutAmount: number;
  batchId: string;
  sourceFileName: string | null;
  createdAt: string;
}

export interface PayrollUploadResult {
  batchId: string;
  matchedCount: number;
  unmatchedCount: number;
  unmatched: { row: number; fullName: string; phone: string }[];
}

export interface ChatSummary {
  courierId: string;
  lastMessage: string | null;
  unread: number;
  lastAt: string;
}

export interface ProfileChangeRequest {
  id: string;
  courierId: string;
  changes: Record<string, string>;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  courier: { id: string; fullName: string; phone: string } | null;
}

export interface AdminCreateCourierResult {
  courier: Courier;
  password: string;
}

export interface HoursDay {
  date: string;
  planHours: number;
  factHours: number;
  isShort: boolean;
  samokatConfirmedHours: number | null;
  samokatIntervalHours: number | null;
  mismatch: boolean;
}

export interface HoursSummaryCourier {
  courierId: string;
  fullName: string;
  phone: string;
  totalFactHours: number;
  days: HoursDay[];
}

export interface HoursSummary {
  from: string;
  to: string;
  dates: string[];
  couriers: HoursSummaryCourier[];
}

export const FIELD_LABEL: Record<string, string> = {
  fullName: "ФИО",
  phone: "Телефон",
  medBookNumber: "Мед. книжка",
  bikeNumber: "Велосипед",
  photoUrl: "Фото",
};
