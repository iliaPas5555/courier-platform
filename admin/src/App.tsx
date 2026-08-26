import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import Login from "./pages/Login";
import Layout from "./pages/Layout";
import Couriers from "./pages/Couriers";
import CourierDetail from "./pages/CourierDetail";
import Schedule from "./pages/Schedule";
import Payments from "./pages/Payments";
import Register from "./pages/Register";
import ChatInbox from "./pages/ChatInbox";
import ChatWithCourier from "./pages/ChatWithCourier";
import FeedbackAll from "./pages/FeedbackAll";
import Hours from "./pages/Hours";
import ProfileRequests from "./pages/ProfileRequests";
import HoursEntries from "./pages/HoursEntries";
import Lateness from "./pages/Lateness";
import Admins from "./pages/Admins";

function RequireAuth({ children }: { children: ReactElement }) {
  const { admin } = useAuth();
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/couriers" element={<Couriers />} />
        <Route path="/couriers/:id" element={<CourierDetail />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/register" element={<Register />} />
        <Route path="/hours" element={<Hours />} />
        <Route path="/hours-entries" element={<HoursEntries />} />
        <Route path="/lateness" element={<Lateness />} />
        <Route path="/admins" element={<Admins />} />
        <Route path="/profile-requests" element={<ProfileRequests />} />
        <Route path="/chat" element={<ChatInbox />} />
        <Route path="/chat/:courierId" element={<ChatWithCourier />} />
        <Route path="/feedback" element={<FeedbackAll />} />
      </Route>
      <Route path="*" element={<Navigate to="/couriers" replace />} />
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
