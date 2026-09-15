"use client";

/**
 * Holds the current user for the whole app. The topbar lives in the root
 * layout, which does NOT remount on client-side navigation — so a component
 * that fetched /api/me on mount would keep whatever answer it got on the first
 * page (logo-only chrome after a login, stale chrome after a logout). Auth
 * transitions go through `refresh`/`signOut` here instead, and everything that
 * renders identity reads this one value.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client/api";

/** Mirrors `publicUser` in lib/auth/guards.ts. */
export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

interface SessionValue {
  /** `undefined` while the first /api/me is in flight, `null` when signed out. */
  me: SessionUser | null | undefined;
  /** Re-read the session — call after a login or signup. */
  refresh: () => Promise<void>;
  /** Drop the session and return to /login. */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ user: SessionUser }>("/api/me");
      setMe(res.user);
    } catch {
      setMe(null);
    }
  }, []);

  // The first read is inlined rather than calling `refresh()` — setState in a
  // promise callback, which is what the rest of the app's fetches do too.
  useEffect(() => {
    let active = true;
    api<{ user: SessionUser }>("/api/me")
      .then((res) => active && setMe(res.user))
      .catch(() => active && setMe(null));
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    setMe(null); // drop the identity chrome immediately
    // The POST failing doesn't stop the redirect — the cookie is either already
    // gone or about to expire.
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    toast.success("Logged out");
    router.push("/login");
  }, [router]);

  return (
    <SessionContext.Provider value={{ me, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
