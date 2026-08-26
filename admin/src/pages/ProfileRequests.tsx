import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, FIELD_LABEL } from "../lib/api";
import type { ProfileChangeRequest } from "../lib/api";
import { formatDateTime } from "../lib/format";

export default function ProfileRequests() {
  const [requests, setRequests] = useState<ProfileChangeRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<ProfileChangeRequest[]>("/profile-requests?status=PENDING")
      .then(setRequests)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/profile-requests/${id}/approve`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось одобрить заявку");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/profile-requests/${id}/reject`, { note: note.trim() || undefined });
      setRejectingId(null);
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отклонить заявку");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">Заявки на изменение анкеты</h2>
      </div>
      {error && <div className="error-text">{error}</div>}

      {requests?.length === 0 && <div className="card muted">Заявок на рассмотрении нет</div>}

      {requests?.map((r) => (
        <div className="card" key={r.id}>
          <div className="flex-between mb-12">
            <div>
              <Link to={`/couriers/${r.courierId}`} style={{ fontWeight: 700 }}>
                {r.courier?.fullName ?? "Курьер"}
              </Link>
              <div className="muted">{r.courier?.phone}</div>
            </div>
            <div className="muted">{formatDateTime(r.createdAt)}</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            {Object.entries(r.changes).map(([field, value]) => (
              <div key={field} className="flex-between" style={{ padding: "4px 0" }}>
                <span className="muted">{FIELD_LABEL[field] ?? field}</span>
                {field === "photoUrl" ? (
                  <img src={value} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} />
                ) : (
                  <span style={{ fontWeight: 600 }}>{value}</span>
                )}
              </div>
            ))}
          </div>

          {rejectingId === r.id ? (
            <div>
              <textarea
                placeholder="Причина отклонения (необязательно)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{ marginBottom: 10 }}
              />
              <div className="flex gap-8">
                <button className="btn btn-danger" disabled={busyId === r.id} onClick={() => reject(r.id)}>
                  Подтвердить отклонение
                </button>
                <button className="btn" onClick={() => setRejectingId(null)}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-8">
              <button className="btn btn-primary" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                Одобрить
              </button>
              <button className="btn btn-danger" disabled={busyId === r.id} onClick={() => setRejectingId(r.id)}>
                Отклонить
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
