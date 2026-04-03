import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authApi, ApiError } from "@/lib/api";

// Backend uses Prisma UserRole enum — map to simpler frontend keys
const ROLE_MAP: Record<string, string> = {
  ADMINISTRATOR: "admin",
  PURCHASE_HANDLER: "purchase",
  STORES_HANDLER: "stores",
  MANUFACTURING_SUPERVISOR: "manufacturing",
  MANUFACTURING_WORKER: "manufacturing",
  SALES_HANDLER: "sales",
  MANAGEMENT: "admin",
};

export type UserRole = "admin" | "purchase" | "stores" | "manufacturing" | "sales";

export interface User {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  backendRole: string; // raw role from backend
}

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  user: User | null;
  username: string;
  role: UserRole;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

function mapUser(raw: Record<string, unknown>): User {
  const backendRole = (raw.role as string) || "ADMINISTRATOR";
  return {
    userId: (raw.userId || raw.id) as string,
    username: raw.username as string,
    fullName: raw.fullName as string,
    email: raw.email as string,
    role: (ROLE_MAP[backendRole] || "admin") as UserRole,
    backendRole,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    let mounted = true;
    authApi.session()
      .then(res => {
        if (mounted && res.data && typeof res.data === 'object' && 'username' in res.data) {
          setUser(mapUser(res.data as Record<string, unknown>));
        }
      })
      .catch(() => {
        // No active session — that's fine
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    if (res.data) {
      setUser(mapUser(res.data as Record<string, unknown>));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear client state even if server call fails
    }
    setUser(null);
  }, []);

  const isLoggedIn = !!user;
  const username = user?.username ?? "";
  const role: UserRole = user?.role ?? "admin";

  return (
    <AuthContext.Provider value={{ isLoggedIn, isLoading, user, username, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
