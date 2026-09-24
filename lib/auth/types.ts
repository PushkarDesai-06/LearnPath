/** Mirrors `publicUser` in lib/auth/guards.ts — the only user shape sent to the browser. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}
