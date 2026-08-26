import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Courier, AdminCreateCourierResult, City } from "../lib/api";
import { formatMoney, formatDate } from "../lib/format";

export default function Couriers() {
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<AdminCreateCourierResult | null>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api
      .get<Courier[]>("/couriers")
      .then(setCouriers)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">Курьеры</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Добавить курьера
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}

      {created && (
        <div className="success-banner">
          Курьер «{created.courier.fullName}» зарегистрирован. Пароль для входа (сохраните и передайте курьеру —
          повторно не показывается): <b>{created.password}</b>{" "}
          <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(created.password)}>
            Скопировать
          </button>{" "}
          <button className="btn btn-sm" onClick={() => setCreated(null)}>
            Понятно
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Город</th>
              <th>Телефон</th>
              <th>Табельный №</th>
              <th>Баланс</th>
              <th>Активен</th>
              <th>С нами с</th>
            </tr>
          </thead>
          <tbody>
            {couriers?.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/couriers/${c.id}`)}>
                <td>{c.fullName}</td>
                <td>{c.city ?? "—"}</td>
                <td>{c.phone}</td>
                <td>{c.personnelNumber || "—"}</td>
                <td>{formatMoney(c.balance)}</td>
                <td>{c.isActive ? "да" : "нет"}</td>
                <td>{formatDate(c.createdAt)}</td>
              </tr>
            ))}
            {couriers?.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ padding: 20 }}>
                  Пока нет зарегистрированных курьеров
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <AddCourierModal
          onClose={() => setShowForm(false)}
          onCreated={(result) => {
            setShowForm(false);
            setCreated(result);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddCourierModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: AdminCreateCourierResult) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [medBookNumber, setMedBookNumber] = useState("");
  const [bikeNumber, setBikeNumber] = useState("");
  const [city, setCity] = useState<City>("МСК");
  const [personnelNumber, setPersonnelNumber] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("fullName", fullName);
      form.append("phone", phone);
      form.append("medBookNumber", medBookNumber);
      form.append("bikeNumber", bikeNumber);
      form.append("city", city);
      if (personnelNumber.trim()) form.append("personnelNumber", personnelNumber.trim());
      if (photo) form.append("photo", photo);
      const result = await api.post<AdminCreateCourierResult>("/couriers", form);
      onCreated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось зарегистрировать курьера");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Новый курьер</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label>ФИО</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Телефон</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." required />
          </div>
          <div className="field">
            <label>Номер мед. книжки</label>
            <input value={medBookNumber} onChange={(e) => setMedBookNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label>Номер велосипеда</label>
            <input value={bikeNumber} onChange={(e) => setBikeNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label>Город</label>
            <select value={city} onChange={(e) => setCity(e.target.value as City)} required>
              <option value="МСК">МСК</option>
              <option value="СПБ">СПБ</option>
            </select>
          </div>
          <div className="field">
            <label>Табельный номер (необязательно)</label>
            <input value={personnelNumber} onChange={(e) => setPersonnelNumber(e.target.value)} />
          </div>
          <div className="field">
            <label>Фото (необязательно)</label>
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="flex gap-8" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Зарегистрировать
            </button>
            <button className="btn" type="button" onClick={onClose}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
