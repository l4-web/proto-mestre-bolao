import { useEffect, useState } from "react";
import { loadMe, type AuthUser } from "./auth-client";

export type { AuthUser };

interface SessionState {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
}

/**
 * Lê a sessão do master (auth-api) via `GET /api/auth/me` (cookie httpOnly,
 * same-origin). É a MESMA sessão do master: como o cookie é same-origin, o
 * módulo a lê sem novo login. Anônimo → o gate (RequireAuth) manda pro `/login`
 * do master. Contrato `{ user, loading, isAuthenticated }`.
 */
export function useSession(): SessionState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadMe().then((me) => {
      if (!active) return;
      setUser(me?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { user, loading, isAuthenticated: !!user };
}
