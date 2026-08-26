import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Payment, FeedbackReport, PayrollEntry, ProfileChangeRequest } from "../lib/api";
import { FIELD_LABEL } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { formatMoney, formatDateTime, STATUS_LABEL, STATUS_COLOR } from "../lib/format";
import BottomNav from "../components/BottomNav";

export default function Profile() {
  const { courier, logout } = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [feedback, setFeedback] = useState<FeedbackReport[]>([]);
  const [lastRequest, setLastRequest] = useState<ProfileChangeRequest | null>(null);
  const [editing, setEditing] = useState(false);

  const loadRequests = () =>
    api.get<ProfileChangeRequest[]>("/profile-requests/me").then((list) => setLastRequest(list[0] ?? null));

  useEffect(() => {
    api.get<{ balance: number; payments: Payment[] }>("/payments/me").then((r) => setPayments(r.payments));
    api.get<PayrollEntry[]>("/payroll/me").then(setPayroll);
    api.get<FeedbackReport[]>("/feedback/me").then(setFeedback);
    loadRequests();
  }, []);

  const hasPending = lastRequest?.status === "PENDING";

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
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <span className="muted">Велосипед</span>
            <span>{courier?.bikeNumber}</span>
          </div>

          {hasPending && (
            <div className="info-banner">
              Заявка на изменение анкеты отправлена {formatDateTime(lastRequest!.createdAt)} и ждёт решения
              администратора.
            </div>
          )}
          {lastRequest?.status === "REJECTED" && !hasPending && (
            <div className="alert-banner">
              Последняя заявка отклонена{lastRequest.adminNote ? `: ${lastRequest.adminNote}` : ""}.
            </div>
          )}

          {!editing && !hasPending && (
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              Редактировать анкету
            </button>
          )}
          {editing && (
            <EditProfileForm
              onCancel={() => setEditing(false)}
              onSubmitted={() => {
                setEditing(false);
                loadRequests();
              }}
            />
          )}
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

function EditProfileForm({ onCancel, onSubmitted }: { onCancel: () => void; onSubmitted: () => void }) {
  const { courier, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(courier?.fullName ?? "");
  const [phone, setPhone] = useState(courier?.phone ?? "");
  const [medBookNumber, setMedBookNumber] = useState(courier?.medBookNumber ?? "");
  const [bikeNumber, setBikeNumber] = useState(courier?.bikeNumber ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      if (fullName.trim() !== courier?.fullName) form.append("fullName", fullName.trim());
      if (phone.trim() !== courier?.phone) form.append("phone", phone.trim());
      if (medBookNumber.trim() !== courier?.medBookNumber) form.append("medBookNumber", medBookNumber.trim());
      if (bikeNumber.trim() !== courier?.bikeNumber) form.append("bikeNumber", bikeNumber.trim());
      if (photo) form.append("photo", photo);

      if ([...form.keys()].length === 0) {
        setError("Измените хотя бы одно поле");
        setBusy(false);
        return;
      }

      await api.post("/profile-requests", form);
      await refreshProfile().catch(() => {});
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12 }}>
      <div className="muted" style={{ marginBottom: 10 }}>
        Изменения применятся только после одобрения администратором.
      </div>
      <div className="field">
        <label>{FIELD_LABEL.fullName}</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="field">
        <label>{FIELD_LABEL.phone}</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="field">
        <label>{FIELD_LABEL.medBookNumber}</label>
        <input value={medBookNumber} onChange={(e) => setMedBookNumber(e.target.value)} />
      </div>
      <div className="field">
        <label>{FIELD_LABEL.bikeNumber}</label>
        <input value={bikeNumber} onChange={(e) => setBikeNumber(e.target.value)} />
      </div>
      <div className="field">
        <label>Новое фото (необязательно)</label>
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="flex gap-8">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Отправить на одобрение
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
