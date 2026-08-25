import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function AuthPage() {
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  // login
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // register
  const [fullName, setFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [medBookNumber, setMedBookNumber] = useState("");
  const [bikeNumber, setBikeNumber] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(phone, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!photo) {
      setError("Прикрепите фото");
      return;
    }
    try {
      const form = new FormData();
      form.append("fullName", fullName);
      form.append("phone", regPhone);
      form.append("password", regPassword);
      form.append("medBookNumber", medBookNumber);
      form.append("bikeNumber", bikeNumber);
      form.append("photo", photo);
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    }
  }

  return (
    <div className="center-screen">
      <div className="auth-card">
        <h1 style={{ textAlign: "center", marginBottom: 4 }}>Курьерская платформа</h1>
        <p className="muted" style={{ textAlign: "center", marginBottom: 20 }}>
          Смены, выплаты и чат с администратором
        </p>
        <div className="auth-tabs">
          <button className={"auth-tab" + (tab === "login" ? " active" : "")} onClick={() => setTab("login")}>
            Вход
          </button>
          <button className={"auth-tab" + (tab === "register" ? " active" : "")} onClick={() => setTab("register")}>
            Регистрация
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Телефон</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." required />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Входим..." : "Войти"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="field">
              <label>ФИО</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Телефон</label>
              <input value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+7..." required />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="field">
              <label>Номер медицинской книжки</label>
              <input value={medBookNumber} onChange={(e) => setMedBookNumber(e.target.value)} required />
            </div>
            <div className="field">
              <label>Номер велосипеда</label>
              <input value={bikeNumber} onChange={(e) => setBikeNumber(e.target.value)} required />
            </div>
            <div className="field">
              <label>Фото</label>
              <input type="file" accept="image/*" capture="user" onChange={(e) => setPhoto(e.target.files?.[0] || null)} required />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Отправляем..." : "Зарегистрироваться"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
