import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import type { Admin } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { formatDate } from "../lib/format";

export default function Admins() {
  const { admin: me } = useAuth();
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    api
      .get<Admin[]>("/admins")
      .then(setAdmins)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function remove(id: string) {
    setError(null);
    try {
      await api.del(`/admins/${id}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить администратора");
    }
  }

  return (
    <div>
      <div className="flex-between mb-12">
        <h2 className="page-title">Администраторы</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Добавить администратора
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>С нами с</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {admins?.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.fullName} {a.id === me?.id && <span className="muted">(вы)</span>}
                </td>
                <td>{a.phone}</td>
                <td>{formatDate(a.createdAt)}</td>
                <td>
                  {a.id !== me?.id && (
                    <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {admins?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ padding: 20 }}>
                  Администраторов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <AddAdminModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddAdminModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/admins/register", { fullName, phone, password });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось зарегистрировать администратора");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Новый администратор</h2>
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
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="flex gap-8" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Создаём..." : "Зарегистрировать"}
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
