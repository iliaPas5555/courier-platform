import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Shift, AppNotification } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { formatMoney, formatDateTime, STATUS_LABEL, STATUS_COLOR } from "../lib/format";
import BottomNav from "../components/BottomNav";

export default function Home() {
  const { courier, refreshProfile } = useAuth();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, n] = await Promise.all([
      api.get<Shift[]>("/shifts/me"),
      api.get<AppNotification[]>("/notifications/me"),
    ]);
    setShifts(s);
    setNotifications(n.slice(0, 5));
    refreshProfile().catch(() => {});
  }, [refreshProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const active = shifts?.find((s) => s.status === "CHECKED_IN" || s.status === "LATE");
  const upcoming = shifts
    ?.filter((s) => s.status === "PLANNED")
    .sort((a, b) => (a.scheduledStart < b.scheduledStart ? -1 : 1))[0];
  const focusShift = active || upcoming;

  async function handleCheckIn(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/shifts/${id}/check-in`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отметить выход");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/shifts/${id}/check-out`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось завершить смену");
    } finally {
      setBusy(false);
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="top-bar">Привет, {courier?.fullName.split(" ")[0]} 👋</div>
      <div className="screen">
        <div className="balance-card">
          <div className="label">Баланс</div>
          <div className="value">{formatMoney(courier?.balance ?? 0)}</div>
        </div>

        {focusShift ? (
          <div className="card">
            <div className="flex-between mb-12">
              <h2>{focusShift.checkInAt ? "Текущая смена" : "Ближайшая смена"}</h2>
              <span className="badge" style={{ background: STATUS_COLOR[focusShift.status] }}>
                {STATUS_LABEL[focusShift.status]}
              </span>
            </div>
            <div className="muted">
              {formatDateTime(focusShift.scheduledStart)} — {formatDateTime(focusShift.scheduledEnd)}
            </div>
            {focusShift.status === "LATE" && (
              <div className="error-text">
                Вы опаздываете. Отметьтесь и укажите причину в{" "}
                <Link to={`/feedback/new?shiftId=${focusShift.id}&type=LATE`}>форме обратной связи</Link>.
              </div>
            )}
            {error && <div className="error-text">{error}</div>}
            <div style={{ marginTop: 12 }}>
              {!focusShift.checkInAt && (
                <button className="btn btn-success" disabled={busy} onClick={() => handleCheckIn(focusShift.id)}>
                  Отметить выход на смену
                </button>
              )}
              {focusShift.checkInAt && !focusShift.checkOutAt && (
                <button className="btn btn-primary" disabled={busy} onClick={() => handleCheckOut(focusShift.id)}>
                  Завершить смену
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="card muted">На ближайшее время смен не запланировано</div>
        )}

        <div className="card">
          <div className="flex-between mb-12">
            <h2>Уведомления</h2>
            {unreadNotifications > 0 && <span className="badge" style={{ background: "#dc2626" }}>{unreadNotifications}</span>}
          </div>
          {notifications.length === 0 && <div className="muted">Пока пусто</div>}
          {notifications.map((n) => (
            <div key={n.id} className={"notif-item" + (!n.readAt ? " unread" : "")}>
              <div>{n.message}</div>
              <div className="muted">{formatDateTime(n.sentAt)}</div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav unreadNotifications={unreadNotifications} />
    </>
  );
}
