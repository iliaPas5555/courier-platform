import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { HoursEntriesMe } from "../lib/api";
import BottomNav from "../components/BottomNav";

const WEEKDAY_LABEL = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatShortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function computeHours(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return Math.round(((endMin - startMin) / 60) * 10) / 10;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: "На проверке", color: "#d97706" },
  APPROVED: { label: "Подтверждено", color: "#16a34a" },
  REJECTED: { label: "Отклонено", color: "#dc2626" },
};

interface DayValue {
  periodStart: string;
  periodEnd: string;
}

export default function HoursSubmit() {
  const navigate = useNavigate();
  const [data, setData] = useState<HoursEntriesMe | null>(null);
  const [values, setValues] = useState<Record<string, DayValue>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<HoursEntriesMe>("/hours-entries/me").then((d) => {
      setData(d);
      const v: Record<string, DayValue> = {};
      for (const day of d.days) {
        if (day.periodStart || day.periodEnd) {
          v[day.date] = { periodStart: day.periodStart ?? "", periodEnd: day.periodEnd ?? "" };
        }
      }
      setValues(v);
    });
  }, []);

  function setDay(date: string, patch: Partial<DayValue>) {
    const empty: DayValue = { periodStart: "", periodEnd: "" };
    setValues((v) => ({ ...v, [date]: { ...empty, ...v[date], ...patch } }));
  }

  async function submit() {
    const days = Object.entries(values)
      .filter(([, v]) => v.periodStart && v.periodEnd)
      .map(([date, v]) => ({ date, periodStart: v.periodStart, periodEnd: v.periodEnd }));

    if (days.length === 0) {
      setError("Укажите период смены хотя бы за один день");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.post("/hours-entries", { days });
      setSuccess(true);
      const d = await api.get<HoursEntriesMe>("/hours-entries/me");
      setData(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить часы");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="top-bar" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span onClick={() => navigate(-1)} style={{ cursor: "pointer" }}>
          ←
        </span>
        Часы за неделю
      </div>
      <div className="screen">
        <div className="card muted">
          Укажите время начала и конца смены по каждому дню текущей недели — часы система посчитает сама.
          После отправки администратор подтвердит или отклонит запись.
        </div>

        {success && <div className="success-text">Часы отправлены на подтверждение</div>}

        {data?.days.map((day, i) => {
          const badge = day.status ? STATUS_BADGE[day.status] : null;
          const v = values[day.date] ?? { periodStart: "", periodEnd: "" };
          const preview = computeHours(v.periodStart, v.periodEnd);
          return (
            <div className="card" key={day.date}>
              <div className="flex-between mb-12">
                <div style={{ fontWeight: 600 }}>
                  {WEEKDAY_LABEL[i]}, {formatShortDate(day.date)}
                </div>
                {badge && (
                  <span className="badge" style={{ background: badge.color }}>
                    {badge.label}
                  </span>
                )}
              </div>
              <div className="flex gap-8">
                <div style={{ flex: 1 }}>
                  <label>С</label>
                  <input
                    type="time"
                    value={v.periodStart}
                    onChange={(e) => setDay(day.date, { periodStart: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>По</label>
                  <input
                    type="time"
                    value={v.periodEnd}
                    onChange={(e) => setDay(day.date, { periodEnd: e.target.value })}
                  />
                </div>
              </div>
              {preview != null && <div className="muted" style={{ marginTop: 8 }}>Итого: {preview} ч</div>}
              {day.status === "REJECTED" && day.adminNote && (
                <div className="error-text" style={{ marginTop: 8 }}>
                  Причина отклонения: {day.adminNote}
                </div>
              )}
              {day.status === "APPROVED" && (
                <div className="muted" style={{ marginTop: 8 }}>
                  Изменение периода отправит запись на повторную проверку
                </div>
              )}
            </div>
          );
        })}

        {error && <div className="error-text">{error}</div>}

        <button className="btn btn-primary" disabled={busy || !data} onClick={submit}>
          Отправить на подтверждение
        </button>
      </div>
      <BottomNav />
    </>
  );
}
