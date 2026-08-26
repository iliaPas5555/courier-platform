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

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: "На проверке", color: "#d97706" },
  APPROVED: { label: "Подтверждено", color: "#16a34a" },
  REJECTED: { label: "Отклонено", color: "#dc2626" },
};

export default function HoursSubmit() {
  const navigate = useNavigate();
  const [data, setData] = useState<HoursEntriesMe | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<HoursEntriesMe>("/hours-entries/me").then((d) => {
      setData(d);
      const v: Record<string, string> = {};
      for (const day of d.days) if (day.hours != null) v[day.date] = String(day.hours);
      setValues(v);
    });
  }, []);

  async function submit() {
    const days = Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([date, v]) => ({ date, hours: Number(v) }));

    if (days.length === 0) {
      setError("Укажите часы хотя бы за один день");
      return;
    }
    if (days.some((d) => Number.isNaN(d.hours) || d.hours < 0 || d.hours > 24)) {
      setError("Часы должны быть числом от 0 до 24");
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
          Проставьте, сколько часов вы отработали в каждый день текущей недели. После отправки администратор
          подтвердит или отклонит запись — эти часы попадут в общую сверку.
        </div>

        {success && <div className="success-text">Часы отправлены на подтверждение</div>}

        {data?.days.map((day, i) => {
          const badge = day.status ? STATUS_BADGE[day.status] : null;
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
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step={0.5}
                placeholder="Часы"
                value={values[day.date] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [day.date]: e.target.value }))}
              />
              {day.status === "REJECTED" && day.adminNote && (
                <div className="error-text" style={{ marginTop: 8 }}>
                  Причина отклонения: {day.adminNote}
                </div>
              )}
              {day.status === "APPROVED" && (
                <div className="muted" style={{ marginTop: 8 }}>
                  Изменение значения отправит запись на повторную проверку
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
