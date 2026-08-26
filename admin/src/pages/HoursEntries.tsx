import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { HoursEntry } from "../lib/api";
import { formatDateTime } from "../lib/format";

export default function HoursEntries() {
  const [entries, setEntries] = useState<HoursEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<HoursEntry[]>("/hours-entries?status=PENDING")
      .then(setEntries)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const groups = useMemo(() => {
    if (!entries) return [];
    const byCourier = new Map<string, HoursEntry[]>();
    for (const e of entries) {
      const list = byCourier.get(e.courierId) ?? [];
      list.push(e);
      byCourier.set(e.courierId, list);
    }
    return [...byCourier.entries()].map(([courierId, list]) => ({
      courierId,
      courier: list[0].courier,
      entries: list.sort((a, b) => (a.date < b.date ? -1 : 1)),
    }));
  }, [entries]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/hours-entries/${id}/approve`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось подтвердить");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/hours-entries/${id}/reject`, { note: note.trim() || undefined });
      setRejectingId(null);
      setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отклонить");
    } finally {
      setBusyId(null);
    }
  }

  async function approveAll(courierId: string, ids: string[]) {
    setBusyGroup(courierId);
    try {
      await api.post("/hours-entries/approve-bulk", { ids });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось подтвердить");
    } finally {
      setBusyGroup(null);
    }
  }

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">Табели (часы от курьеров)</h2>
      </div>
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Курьеры сами проставляют отработанные часы в приложении. Подтверждённые часы попадают в сверку на
          странице «Часы» как отдельный источник (используется, если у смены нет своей отметки выхода/окончания).
        </p>
      </div>

      {error && <div className="error-text">{error}</div>}
      {groups.length === 0 && entries && <div className="card muted">Записей на рассмотрении нет</div>}

      {groups.map((g) => (
        <div className="card" key={g.courierId}>
          <div className="flex-between mb-12">
            <Link to={`/couriers/${g.courierId}`} style={{ fontWeight: 700 }}>
              {g.courier?.fullName ?? "Курьер"}
            </Link>
            {g.entries.length > 1 && (
              <button
                className="btn btn-primary"
                disabled={busyGroup === g.courierId}
                onClick={() => approveAll(g.courierId, g.entries.map((e) => e.id))}
              >
                Одобрить все ({g.entries.length})
              </button>
            )}
          </div>

          {g.entries.map((r) => (
            <div key={r.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
              <div className="flex-between">
                <div>
                  <b>{r.date}</b>
                  {r.periodStart && r.periodEnd ? (
                    <>
                      {" "}
                      {r.periodStart}–{r.periodEnd} ({r.hours} ч)
                    </>
                  ) : (
                    <> — {r.hours} ч</>
                  )}
                  <span className="muted" style={{ marginLeft: 10 }}>
                    отправлено {formatDateTime(r.submittedAt)}
                  </span>
                </div>
                {rejectingId !== r.id && (
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
              {rejectingId === r.id && (
                <div style={{ marginTop: 8 }}>
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
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
