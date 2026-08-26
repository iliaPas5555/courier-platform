import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  // вход
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // регистрация
  const [fullName, setFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(phone, password);
      navigate("/couriers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await register(fullName, regPhone, regPassword);
      navigate("/couriers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось зарегистрироваться");
    }
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <h1>Курьерская платформа</h1>
        <p>{tab === "login" ? "Вход в панель администратора" : "Регистрация администратора"}</p>

        <div className="auth-tabs" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={"auth-tab" + (tab === "login" ? " active" : "")}
            onClick={() => {
              setTab("login");
              setError(null);
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={"auth-tab" + (tab === "register" ? " active" : "")}
            onClick={() => {
              setTab("register");
              setError(null);
            }}
          >
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
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
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
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Регистрируем..." : "Зарегистрироваться"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
