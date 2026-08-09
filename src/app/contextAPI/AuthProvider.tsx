"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/utils/supabase/client";

export type AuthStatus = "loading" | "anon" | "needs_profile" | "ok";

export interface AuthUser {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
}

interface AuthContextValue {
  /** "loading" until the first check resolves, then "anon" | "needs_profile" | "ok". */
  status: AuthStatus;
  user: AuthUser | null;
  /** True once there's a real session (status is "ok" or "needs_profile"). */
  isAuthenticated: boolean;
  /** True once the initial auth check has resolved (status !== "loading"). */
  ready: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  status: "loading",
  user: null,
  isAuthenticated: false,
  ready: false,
  refresh: async () => {},
});

/**
 * Single source of truth for "am I logged in / who am I" across the whole app.
 * Everything that needs auth state (header, preferences, media interactions)
 * should read from this instead of independently polling Supabase — that
 * duplication was the root cause of the header disagreeing with the rest of
 * the app about login state.
 */
export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const fetchingRef = useRef(false);

  const fetchUser = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await fetch("/api/navbar", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`navbar request failed: ${response.status}`);
      const data = await response.json();
      setStatus((data?.status ?? "anon") as AuthStatus);
      setUser(data?.user ?? null);
    } catch {
      setStatus("anon");
      setUser(null);
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // INITIAL_SESSION fires synchronously on subscribe and would just
      // duplicate the fetchUser() call above — skip it.
      if (event === "INITIAL_SESSION") return;
      fetchUser();
    });

    // A backgrounded tab can miss a token refresh/expiry — re-check whenever
    // the tab becomes visible/focused again so state never goes stale.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchUser();
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [fetchUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "ok" || status === "needs_profile",
      ready: status !== "loading",
      refresh: fetchUser,
    }),
    [status, user, fetchUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
