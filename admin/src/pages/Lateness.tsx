import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Courier, LatenessEntry, LatenessStat } from "../lib/api";
import { formatDate } from "../lib/format";

export default function Lateness() {
  const [params] = useSearchParams();
  const courierId = params.get("courierId");
  const [data, setData] = useState<{ entries: LatenessEntry[]; stats: LatenessStat[] } | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ entries: LatenessEntry[]; stats: LatenessStat[] }>(
        courierId ? `/lateness?courierId=${courierId}` : "/lateness"
      )
      .then(setData)
      .catch((e) => setError(e.message));
  }, [courierId]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get<Courier[]>("/couriers").then(setCouriers).catch(() => {});
  }, []);

  async function remove(id: string) {
    try {
      await api.del(`/lateness/${id}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить запись");
    }
  }

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">Опоздания</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Добавить опоздание
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}

      {data && data.stats.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Статистика по курьерам</h2>
          <table>
            <thead>
              <tr>
                <th>Курьер</th>
                <th>Опозданий</th>
              </tr>
            </thead>
            <tbody>
              {data.stats.map((s) => (
                <tr key={s.courierId}>
                  <td>
                    <Link to={`/couriers/${s.courierId}`}>{s.fullName}</Link>
                  </td>
                  <td>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Курьер</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.date)}</td>
                <td>
                  <Link to={`/couriers/${e.courierId}`}>{e.courier?.fullName ?? "—"}</Link>
                </td>
                <td>{e.note || "—"}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => remove(e.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {data?.entries.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 20 }}>
                  Опозданий пока не зафиксировано
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <AddLatenessModal
          couriers={couriers}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddLatenessModal({
  couriers,
  onClose,
  onCreated,
}: {
  couriers: Courier[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [courierId, setCourierId] = useState(couriers[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!courierId) {
      setError("Выберите курьера");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/lateness", { courierId, date, note: note.trim() || undefined });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить запись");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Новое опоздание</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label>Курьер</label>
            <select value={courierId} onChange={(e) => setCourierId(e.target.value)} required>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label>Комментарий (необязательно)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например, опоздал на 40 мин" />
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="flex gap-8" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Добавить
            </button>
            <button className="btn" type="button" onClick={onClose}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
