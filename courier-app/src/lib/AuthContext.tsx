import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { api, getToken, setToken } from "./api";
import type { Courier } from "./api";

interface AuthState {
  courier: Courier | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (form: FormData) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [courier, setCourier] = useState<Courier | null>(() => {
    const raw = localStorage.getItem("courier_profile");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const persist = (c: Courier) => {
    localStorage.setItem("courier_profile", JSON.stringify(c));
    setCourier(c);
  };

  const login = useCallback(async (phone: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; courier: Courier }>("/auth/courier/login", { phone, password });
      setToken(res.token);
      persist(res.courier);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (form: FormData) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; courier: Courier }>("/auth/courier/register", form);
      setToken(res.token);
      persist(res.courier);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const c = await api.get<Courier>("/couriers/me");
    persist(c);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem("courier_profile");
    setCourier(null);
  }, []);

  return (
    <AuthContext.Provider value={{ courier: getToken() ? courier : null, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
