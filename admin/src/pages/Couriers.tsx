import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Courier } from "../lib/api";
import { formatMoney, formatDate } from "../lib/format";

export default function Couriers() {
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<Courier[]>("/couriers")
      .then(setCouriers)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">Курьеры</h2>
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Мед. книжка</th>
              <th>Велосипед</th>
              <th>Баланс</th>
              <th>С нами с</th>
            </tr>
          </thead>
          <tbody>
            {couriers?.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/couriers/${c.id}`)}>
                <td>{c.fullName}</td>
                <td>{c.phone}</td>
                <td>{c.medBookNumber}</td>
                <td>{c.bikeNumber}</td>
                <td>{formatMoney(c.balance)}</td>
                <td>{formatDate(c.createdAt)}</td>
              </tr>
            ))}
            {couriers?.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 20 }}>
                  Пока нет зарегистрированных курьеров
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
