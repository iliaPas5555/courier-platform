import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Shift } from "../lib/api";
import { formatDate, formatTime, STATUS_LABEL, STATUS_COLOR } from "../lib/format";
import BottomNav from "../components/BottomNav";

export default function Shifts() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Shift[]>("/shifts/me").then(setShifts);
  }, []);

  useEffect(load, [load]);

  async function checkIn(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/shifts/${id}/check-in`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отметить выход");
    } finally {
      setBusyId(null);
    }
  }

  async function checkOut(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/shifts/${id}/check-out`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось завершить смену");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="top-bar">Мои смены</div>
      <div className="screen">
        {error && <div className="error-text">{error}</div>}
        {shifts?.length === 0 && <div className="card muted">Смен пока нет</div>}
        {shifts?.map((s) => (
          <div className="card" key={s.id}>
            <div className="flex-between mb-12">
              <div>
                <div style={{ fontWeight: 600 }}>{formatDate(s.scheduledStart)}</div>
                <div className="muted">
                  {formatTime(s.scheduledStart)} — {formatTime(s.scheduledEnd)}
                </div>
              </div>
              <span className="badge" style={{ background: STATUS_COLOR[s.status] }}>
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            {s.checkInAt && <div className="muted">Отметка выхода: {formatTime(s.checkInAt)}</div>}
            {s.checkOutAt && <div className="muted">Завершение: {formatTime(s.checkOutAt)}</div>}

            <div className="flex gap-8" style={{ marginTop: 10 }}>
              {s.status === "PLANNED" && (
                <button className="btn btn-success btn-sm" disabled={busyId === s.id} onClick={() => checkIn(s.id)}>
                  Отметить выход
                </button>
              )}
              {s.status === "CHECKED_IN" && (
                <button className="btn btn-primary btn-sm" disabled={busyId === s.id} onClick={() => checkOut(s.id)}>
                  Завершить смену
                </button>
              )}
              {(s.status === "LATE" || s.status === "NO_SHOW") && (
                <Link
                  className="btn btn-danger btn-sm"
                  to={`/feedback/new?shiftId=${s.id}&type=${s.status === "LATE" ? "LATE" : "NO_SHOW"}`}
                >
                  Указать причину
                </Link>
              )}
              {s.status === "LATE" && !s.checkInAt && (
                <button className="btn btn-success btn-sm" disabled={busyId === s.id} onClick={() => checkIn(s.id)}>
                  Отметить выход
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </>
  );
}
