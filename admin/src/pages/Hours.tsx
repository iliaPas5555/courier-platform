import { useEffect, useState } from "react";
import { api, downloadFile } from "../lib/api";
import type { HoursSummary } from "../lib/api";

function formatShortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export default function Hours() {
  const [data, setData] = useState<HoursSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<HoursSummary>("/shifts/hours/summary")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">Сверка часов</h2>
        <div className="flex gap-8">
          <button className="btn" onClick={() => downloadFile("/reports/couriers.xlsx", "couriers.xlsx")}>
            Скачать курьеров (.xlsx)
          </button>
          <button className="btn" onClick={() => downloadFile("/reports/hours.xlsx", "hours.xlsx")}>
            Скачать часы (.xlsx)
          </button>
        </div>
      </div>

      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          Факт — по нашим сменам (отметка выхода/окончания). Красная заливка — смена короче 12 часов.
          Оранжевая рамка — расхождение с данными HR-платформы (hiring.samokat.ru) больше 0.5 часа; наведите
          курсор на ячейку, чтобы увидеть подтверждённые там часы. Период: {data ? `${data.from} — ${data.to}` : "…"}
        </p>
      </div>

      {error && <div className="error-text">{error}</div>}

      {data && (
        <div className="card hours-table-wrap">
          <table className="hours-table">
            <thead>
              <tr>
                <th className="name-col">Курьер</th>
                {data.dates.map((d) => (
                  <th key={d}>{formatShortDate(d)}</th>
                ))}
                <th>Итого</th>
              </tr>
            </thead>
            <tbody>
              {data.couriers.map((c) => (
                <tr key={c.courierId}>
                  <td className="name-col">{c.fullName}</td>
                  {c.days.map((d) => (
                    <td
                      key={d.date}
                      className={
                        (d.isShort ? "hours-cell-short " : "") +
                        (d.mismatch ? "hours-cell-mismatch " : "") +
                        (!d.factHours ? "hours-cell-empty" : "")
                      }
                      title={
                        d.samokatConfirmedHours != null
                          ? `HR-платформа: подтв. ${d.samokatConfirmedHours} ч / интервалы ${d.samokatIntervalHours ?? "—"} ч`
                          : "Нет данных HR-платформы"
                      }
                    >
                      {d.factHours || "—"}
                    </td>
                  ))}
                  <td style={{ fontWeight: 700 }}>{c.totalFactHours}</td>
                </tr>
              ))}
              {data.couriers.length === 0 && (
                <tr>
                  <td colSpan={data.dates.length + 2} className="muted" style={{ padding: 16 }}>
                    Курьеров пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
