const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function getToken() {
  return localStorage.getItem("courier_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("courier_token", token);
  else localStorage.removeItem("courier_token");
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
};

export { API_BASE };

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
  amount: number;
  periodFrom: string;
  periodTo: string;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  note: string | null;
}

export interface FeedbackReport {
  id: string;
  shiftId: string | null;
  type: "LATE" | "NO_SHOW" | "OTHER";
  reason: string;
  mediaUrls: string[];
  status: "NEW" | "REVIEWED";
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderType: "COURIER" | "ADMIN";
  text: string | null;
  mediaUrls: string[];
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  period: string;
  earnedAmount: number;
  heldAmount: number;
  paidOutAmount: number;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  sentAt: string;
  readAt: string | null;
}
