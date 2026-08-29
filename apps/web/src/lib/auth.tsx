import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

const TOKEN_STORAGE_KEY = "routine-tracker:token";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  birthDate: string | null;
  age: number | null;
  unitPreference: "KG" | "LB";
  createdAt: string;
};

type AuthContextValue = {
  token: string | null;
  user: CurrentUser | undefined;
  isLoadingUser: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, birthDate?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const queryClient = useQueryClient();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["me", token],
    queryFn: () => apiFetch<CurrentUser>("/auth/me", { token }),
    enabled: token !== null,
  });

  const login = useCallback(async (email: string, password: string) => {
    const { token: newToken } = await apiFetch<{ token: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string, birthDate?: string) => {
      await apiFetch("/auth/register", {
        method: "POST",
        body: { email, password, name: name || undefined, birthDate: birthDate || undefined },
      });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ token, user, isLoadingUser, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
