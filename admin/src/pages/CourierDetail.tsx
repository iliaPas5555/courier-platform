import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Courier, Shift, Payment, FeedbackReport } from "../lib/api";
import { formatMoney, formatDateTime, STATUS_LABEL, STATUS_COLOR } from "../lib/format";

interface CourierCard {
  courier: Courier;
  shifts: Shift[];
  payments: Payment[];
  feedback: FeedbackReport[];
}

export default function CourierDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CourierCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    api
      .get<CourierCard>(`/couriers/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function markPaid(paymentId: string) {
    await api.patch(`/payments/${paymentId}/mark-paid`);
    load();
  }

  async function markReviewed(feedbackId: string) {
    await api.patch(`/feedback/${feedbackId}/reviewed`);
    load();
  }

  if (error) return <div className="error-text">{error}</div>;
  if (!data) return <div className="muted">Загрузка...</div>;

  const { courier, shifts, payments, feedback } = data;

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">{courier.fullName}</h2>
        <Link className="btn btn-primary" to={`/chat/${courier.id}`}>
          Открыть чат
        </Link>
      </div>

      <div className="card">
        <div className="grid-2">
          <div>
            <div className="muted">Телефон</div>
            <div>{courier.phone}</div>
          </div>
          <div>
            <div className="muted">Баланс</div>
            <div>{formatMoney(courier.balance)}</div>
          </div>
          <div>
            <div className="muted">Номер мед. книжки</div>
            <div>{courier.medBookNumber}</div>
          </div>
          <div>
            <div className="muted">Номер велосипеда</div>
            <div>{courier.bikeNumber}</div>
          </div>
        </div>
        {courier.photoUrl && (
          <img
            src={courier.photoUrl}
            alt={courier.fullName}
            style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, marginTop: 14 }}
          />
        )}
      </div>

      <h3>Смены</h3>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Начало</th>
              <th>Окончание</th>
              <th>Отметка</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td>{formatDateTime(s.scheduledStart)}</td>
                <td>{formatDateTime(s.scheduledEnd)}</td>
                <td>{s.checkInAt ? formatDateTime(s.checkInAt) : "—"}</td>
                <td>
                  <span className="badge" style={{ background: STATUS_COLOR[s.status] }}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </td>
              </tr>
            ))}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 16 }}>
                  Смен пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>Выплаты</h3>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Период</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>
                  {formatDateTime(p.periodFrom)} — {formatDateTime(p.periodTo)}
                </td>
                <td>{formatMoney(p.amount)}</td>
                <td>
                  <span className="badge" style={{ background: STATUS_COLOR[p.status] }}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td>
                  {p.status === "PENDING" && (
                    <button className="btn" onClick={() => markPaid(p.id)}>
                      Отметить оплаченным
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 16 }}>
                  Выплат пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>Обращения (опоздания / невыходы)</h3>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Тип</th>
              <th>Причина</th>
              <th>Вложения</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((f) => (
              <tr key={f.id}>
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
                      Отметить рассмотренным
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {feedback.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 16 }}>
                  Обращений нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
