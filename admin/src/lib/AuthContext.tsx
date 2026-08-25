import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { api, getToken, setToken } from "./api";

interface Admin {
  id: string;
  fullName: string;
  phone: string;
}

interface AuthState {
  admin: Admin | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(() => {
    const raw = localStorage.getItem("admin_profile");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (phone: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; admin: Admin }>("/auth/admin/login", { phone, password });
      setToken(res.token);
      localStorage.setItem("admin_profile", JSON.stringify(res.admin));
      setAdmin(res.admin);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("admin_profile");
    setAdmin(null);
  }, []);

  return <AuthContext.Provider value={{ admin: getToken() ? admin : null, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
