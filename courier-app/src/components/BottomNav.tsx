import { NavLink } from "react-router-dom";

interface Props {
  unreadChat?: number;
  unreadNotifications?: number;
}

export default function BottomNav({ unreadChat = 0, unreadNotifications = 0 }: Props) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
        {unreadNotifications > 0 && <span className="nav-dot" />}
        <span className="nav-icon">🏠</span>
        Главная
      </NavLink>
      <NavLink to="/shifts" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
        <span className="nav-icon">🗓️</span>
        Смены
      </NavLink>
      <NavLink to="/chat" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
        {unreadChat > 0 && <span className="nav-dot" />}
        <span className="nav-icon">💬</span>
        Чат
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
        <span className="nav-icon">👤</span>
        Профиль
      </NavLink>
    </nav>
  );
}
