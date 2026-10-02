/**
 * Client da auth-api (NestJS do master, servida sob `/api/auth/*`, same-origin
 * em prod e atrás do LB/dev-proxy). O módulo NÃO tem login próprio: lê a MESMA
 * sessão do master (cookie httpOnly) via `GET /api/auth/me`. Login mora só no
 * master; anônimo → o gate (RequireAuth) manda pro `/login` do master.
 */

import type { L4Claim } from "@l4-web/authz";

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: { name: string; full_name: string; avatar_url: string | null };
  app_metadata: { provider: string };
}

export interface MeResponse {
  user: AuthUser;
  /** Autorização unificada (claim `l4`) resolvida pela auth-api. null se off. */
  authz: L4Claim | null;
}

// Origem do master (auth-api). "" = mesma origem (prod e dev-proxy do master).
// Em dev local aponte para o master (ex.: http://localhost:5174) no `.env`.
const MASTER_URL = import.meta.env.VITE_MASTER_URL ?? "";
const AUTH_BASE = `${MASTER_URL}/api/auth`;

async function fetchMe(): Promise<MeResponse | null> {
  try {
    const res = await fetch(`${AUTH_BASE}/me`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}

// Memoiza: vários componentes usam useSession no mesmo load → 1 request.
let mePromise: Promise<MeResponse | null> | null = null;
export function loadMe(): Promise<MeResponse | null> {
  return (mePromise ??= fetchMe());
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${AUTH_BASE}/logout`, { method: "POST", credentials: "include" });
  } finally {
    mePromise = null;
  }
}
