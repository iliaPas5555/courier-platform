import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const links = [
  { to: "/couriers", label: "Курьеры" },
  { to: "/schedule", label: "Расписание" },
  { to: "/payments", label: "Выплаты" },
  { to: "/register", label: "Реестр" },
  { to: "/hours", label: "Часы" },
  { to: "/hours-entries", label: "Табели" },
  { to: "/lateness", label: "Опоздания" },
  { to: "/profile-requests", label: "Заявки" },
  { to: "/chat", label: "Чат" },
  { to: "/feedback", label: "Обращения" },
  { to: "/admins", label: "Администраторы" },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Курьеры · Админ</h1>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
            {l.label}
          </NavLink>
        ))}
        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          <div className="muted" style={{ padding: "0 10px 8px" }}>{admin?.fullName}</div>
          <button
            className="btn"
            style={{ width: "100%" }}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
