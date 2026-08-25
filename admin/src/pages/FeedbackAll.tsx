import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { FeedbackReport, Courier } from "../lib/api";
import { formatDateTime, STATUS_LABEL, STATUS_COLOR } from "../lib/format";

export default function FeedbackAll() {
  const [list, setList] = useState<FeedbackReport[]>([]);
  const [couriers, setCouriers] = useState<Record<string, Courier>>({});

  function load() {
    Promise.all([api.get<FeedbackReport[]>("/feedback"), api.get<Courier[]>("/couriers")]).then(([f, c]) => {
      setList(f);
      setCouriers(Object.fromEntries(c.map((x) => [x.id, x])));
    });
  }

  useEffect(load, []);

  async function markReviewed(id: string) {
    await api.patch(`/feedback/${id}/reviewed`);
    load();
  }

  return (
    <div>
      <h2 className="page-title">Обращения курьеров</h2>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Курьер</th>
              <th>Когда</th>
              <th>Тип</th>
              <th>Причина</th>
              <th>Вложения</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link to={`/couriers/${f.courierId}`}>{couriers[f.courierId]?.fullName || f.courierId}</Link>
                </td>
                <td>{formatDateTime(f.createdAt)}</td>
                <td>{f.type === "LATE" ? "Опоздание" : f.type === "NO_SHOW" ? "Невыход" : "Другое"}</td>
                <td>{f.reason}</td>
                <td>
                  {f.mediaUrls.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>
                      файл
                    </a>
                  ))}
                </td>
                <td>
                  <span className="badge" style={{ background: STATUS_COLOR[f.status] }}>
                    {STATUS_LABEL[f.status]}
                  </span>
                </td>
                <td>
                  {f.status === "NEW" && (
                    <button className="btn" onClick={() => markReviewed(f.id)}>
                      Рассмотрено
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 16 }}>
                  Обращений пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
