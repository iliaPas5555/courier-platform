import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Payment, FeedbackReport, PayrollEntry } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { formatMoney, formatDateTime, STATUS_LABEL, STATUS_COLOR } from "../lib/format";
import BottomNav from "../components/BottomNav";

export default function Profile() {
  const { courier, logout } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [feedback, setFeedback] = useState<FeedbackReport[]>([]);

  useEffect(() => {
    api.get<{ balance: number; payments: Payment[] }>("/payments/me").then((r) => setPayments(r.payments));
    api.get<PayrollEntry[]>("/payroll/me").then(setPayroll);
    api.get<FeedbackReport[]>("/feedback/me").then(setFeedback);
  }, []);

  return (
    <>
      <div className="top-bar">Профиль</div>
      <div className="screen">
        <div className="card flex gap-8" style={{ alignItems: "center" }}>
          {courier?.photoUrl ? (
            <img src={courier.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#e5e7eb" }} />
          )}
          <div>
            <div style={{ fontWeight: 700 }}>{courier?.fullName}</div>
            <div className="muted">{courier?.phone}</div>
          </div>
        </div>

        <div className="card">
          <h2>Документы</h2>
          <div className="flex-between mb-12">
            <span className="muted">Мед. книжка</span>
            <span>{courier?.medBookNumber}</span>
          </div>
          <div className="flex-between">
            <span className="muted">Велосипед</span>
            <span>{courier?.bikeNumber}</span>
          </div>
        </div>

        <div className="card">
          <h2>Начисления по неделям</h2>
          <div className="muted" style={{ marginBottom: 10 }}>
            «В баланс» — сумма, которая удерживается компанией и копится на вашем балансе до полного расчёта.
          </div>
          {payroll.length === 0 && <div className="muted">Пока нет начислений</div>}
          {payroll.map((p) => (
            <div key={p.id} className="shift-row" style={{ alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.period}</div>
                <div className="muted">Заработано: {formatMoney(p.earnedAmount)}</div>
                <div className="muted">Выдано на руки: {formatMoney(p.paidOutAmount)}</div>
              </div>
              <div style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>
                +{formatMoney(p.heldAmount)}
                <div className="muted" style={{ fontWeight: 400 }}>в баланс</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>Выплаты вручную</h2>
          {payments.length === 0 && <div className="muted">Пока нет</div>}
          {payments.map((p) => (
            <div key={p.id} className="shift-row">
              <div>
                <div>{formatMoney(p.amount)}</div>
                <div className="muted">
                  {formatDateTime(p.periodFrom)} — {formatDateTime(p.periodTo)}
                </div>
              </div>
              <span className="badge" style={{ background: STATUS_COLOR[p.status] }}>
                {STATUS_LABEL[p.status]}
              </span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="flex-between mb-12">
            <h2>Мои обращения</h2>
            <Link className="btn btn-sm" to="/feedback/new">
              + Новое
            </Link>
          </div>
          {feedback.length === 0 && <div className="muted">Обращений нет</div>}
          {feedback.map((f) => (
            <div key={f.id} className="shift-row" style={{ alignItems: "flex-start" }}>
              <div>
                <div>{f.reason}</div>
                <div className="muted">{formatDateTime(f.createdAt)}</div>
              </div>
              <span className="badge" style={{ background: STATUS_COLOR[f.status] }}>
                {STATUS_LABEL[f.status]}
              </span>
            </div>
          ))}
        </div>

        <button
          className="btn btn-danger"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Выйти
        </button>
      </div>
      <BottomNav />
    </>
  );
}
