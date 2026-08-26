import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Courier, Shift, HoursEntry } from "../lib/api";
import { formatDateTime, formatDate, STATUS_LABEL, STATUS_COLOR } from "../lib/format";

interface Row {
  courierId: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export default function Schedule() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [rows, setRows] = useState<Row[]>([{ courierId: "", scheduledStart: "", scheduledEnd: "" }]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [approvedHours, setApprovedHours] = useState<HoursEntry[] | null>(null);

  const byId = new Map(couriers.map((c) => [c.id, c]));

  const loadSchedule = useCallback(() => {
    api.get<Shift[]>("/shifts").then(setShifts).catch(() => {});
    api.get<HoursEntry[]>("/hours-entries?status=APPROVED").then(setApprovedHours).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Courier[]>("/couriers").then(setCouriers);
    loadSchedule();
  }, [loadSchedule]);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, { courierId: "", scheduledStart: "", scheduledEnd: "" }]);
  }

  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const valid = rows.filter((r) => r.courierId && r.scheduledStart && r.scheduledEnd);
    if (valid.length === 0) {
      setError("Заполните хотя бы одну строку расписания");
      return;
    }
    try {
      await api.post("/shifts", {
        shifts: valid.map((r) => ({
          courierId: r.courierId,
          scheduledStart: new Date(r.scheduledStart).toISOString(),
          scheduledEnd: new Date(r.scheduledEnd).toISOString(),
        })),
      });
      setMessage(`Добавлено смен: ${valid.length}`);
      setRows([{ courierId: "", scheduledStart: "", scheduledEnd: "" }]);
      loadSchedule();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить расписание");
    }
  }

  return (
    <div>
      <h2 className="page-title">Выгрузка расписания</h2>
      <form onSubmit={handleSubmit} className="card">
        {rows.map((row, i) => (
          <div key={i} className="grid-2 mb-12" style={{ alignItems: "end" }}>
            <div>
              <label>Курьер</label>
              <select value={row.courierId} onChange={(e) => updateRow(i, { courierId: e.target.value })} required>
                <option value="">Выберите курьера</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-8" style={{ alignItems: "end" }}>
              <div style={{ flex: 1 }}>
                <label>Начало смены</label>
                <input
                  type="datetime-local"
                  value={row.scheduledStart}
                  onChange={(e) => updateRow(i, { scheduledStart: e.target.value })}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Конец смены</label>
                <input
                  type="datetime-local"
                  value={row.scheduledEnd}
                  onChange={(e) => updateRow(i, { scheduledEnd: e.target.value })}
                  required
                />
              </div>
              {rows.length > 1 && (
                <button type="button" className="btn btn-danger" onClick={() => removeRow(i)}>
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex gap-8 mb-12">
          <button type="button" className="btn" onClick={addRow}>
            + Добавить строку
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
        {message && <div className="muted" style={{ color: "#16a34a" }}>{message}</div>}
        <button className="btn btn-primary">Сохранить расписание</button>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px 0" }}>
          <h2 style={{ margin: 0 }}>Смены</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Курьер</th>
              <th>Начало</th>
              <th>Конец</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {shifts?.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/couriers/${s.courierId}`}>{byId.get(s.courierId)?.fullName ?? s.courierId}</Link>
                </td>
                <td>{formatDateTime(s.scheduledStart)}</td>
                <td>{formatDateTime(s.scheduledEnd)}</td>
                <td>
                  <span className="badge" style={{ background: STATUS_COLOR[s.status] }}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </td>
              </tr>
            ))}
            {shifts?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 20 }}>
                  Смен пока нет — добавьте их формой выше
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px 0" }}>
          <h2 style={{ margin: 0 }}>Часы, подтверждённые курьерами (табели)</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Курьер сам проставляет часы в приложении, вы подтверждаете на странице «Табели» — подтверждённые
            записи подгружаются сюда.
          </p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Курьер</th>
              <th>Дата</th>
              <th>Часы</th>
            </tr>
          </thead>
          <tbody>
            {approvedHours
              ?.slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((h) => (
                <tr key={h.id}>
                  <td>
                    <Link to={`/couriers/${h.courierId}`}>{h.courier?.fullName ?? h.courierId}</Link>
                  </td>
                  <td>{formatDate(h.date)}</td>
                  <td>{h.hours} ч</td>
                </tr>
              ))}
            {approvedHours?.length === 0 && (
              <tr>
                <td colSpan={3} className="muted" style={{ padding: 20 }}>
                  Пока нет подтверждённых часов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
