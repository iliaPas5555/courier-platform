import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import type { Courier } from "../lib/api";

export default function Payments() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [courierId, setCourierId] = useState("");
  const [amount, setAmount] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [note, setNote] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Courier[]>("/couriers").then(setCouriers);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!courierId || !amount || !periodFrom || !periodTo) {
      setError("Заполните все поля");
      return;
    }
    try {
      await api.post("/payments", {
        courierId,
        amount: Math.round(Number(amount) * 100),
        periodFrom: new Date(periodFrom).toISOString(),
        periodTo: new Date(periodTo).toISOString(),
        note: note || undefined,
        markPaid,
      });
      setMessage("Выплата добавлена");
      setAmount("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить выплату");
    }
  }

  return (
    <div>
      <h2 className="page-title">Выплаты</h2>
      <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 480 }}>
        <div className="field">
          <label>Курьер</label>
          <select value={courierId} onChange={(e) => setCourierId(e.target.value)} required>
            <option value="">Выберите курьера</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Сумма, ₽</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                style={{ width: "auto", marginRight: 6 }}
                checked={markPaid}
                onChange={(e) => setMarkPaid(e.target.checked)}
              />
              Сразу отметить оплаченной
            </label>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Период с</label>
            <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} required />
          </div>
          <div className="field">
            <label>Период по</label>
            <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label>Комментарий (необязательно)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="error-text">{error}</div>}
        {message && <div className="muted" style={{ color: "#16a34a" }}>{message}</div>}
        <button className="btn btn-primary">Добавить выплату</button>
      </form>
    </div>
  );
}
