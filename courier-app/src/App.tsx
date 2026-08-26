import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import Shifts from "./pages/Shifts";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import FeedbackNew from "./pages/FeedbackNew";
import HoursSubmit from "./pages/HoursSubmit";

function RequireAuth({ children }: { children: ReactElement }) {
  const { courier } = useAuth();
  if (!courier) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/shifts"
        element={
          <RequireAuth>
            <Shifts />
          </RequireAuth>
        }
      />
      <Route
        path="/chat"
        element={
          <RequireAuth>
            <Chat />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/feedback/new"
        element={
          <RequireAuth>
            <FeedbackNew />
          </RequireAuth>
        }
      />
      <Route
        path="/hours/submit"
        element={
          <RequireAuth>
            <HoursSubmit />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
