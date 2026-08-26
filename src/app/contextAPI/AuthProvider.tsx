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
import { fetchAuthSnapshot, type AuthStatus, type AuthUser } from "@/lib/db/account";

export type { AuthStatus, AuthUser };

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

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * ── Why there is no retry ladder here any more ─────────────────────────────
 *
 * This provider used to call `/api/navbar` — a Vercel function whose entire job
 * was to read the auth cookie and hand back one row of `users`. Because that
 * request could lose a race with a token refresh, a single "anon" answer could
 * flip the header to *Log in* for somebody who was signed in. Two mechanisms
 * grew to defend against that: a three-attempt retry on every anon answer, and
 * a self-healing timer that re-checked every 15 seconds for as long as a
 * Supabase cookie was present. Together they could spend roughly sixteen
 * function invocations a minute on behalf of a browser that was simply logged
 * out, because an expired refresh token leaves the cookie exactly where it is.
 *
 * `supabase.auth.getSession()` removes the race rather than retrying it. It
 * reads the session out of the same cookie, refreshes it when it has expired,
 * and answers from memory when it has not — so the check is local, free, and
 * cannot be beaten to the cookie by another request in flight. If it says there
 * is no session, there is no session, and asking again four times does not
 * change that.
 *
 * What is left is event-driven: `onAuthStateChange` fires on sign-in, sign-out
 * and every token refresh, and a tab becoming visible re-reads in case another
 * tab changed something. Neither costs a function invocation.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const snapshot = await fetchAuthSnapshot();
      setStatus(snapshot.status);
      setUser(snapshot.user);
    } catch {
      // fetchAuthSnapshot already distinguishes "no session" from "the row read
      // failed" and never reports a signed-in person as anonymous. Reaching
      // here means something unexpected threw, and the honest answer for the
      // header is the one it already has.
      setStatus((s) => (s === "loading" ? "anon" : s));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void refresh(), 150);
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // INITIAL_SESSION duplicates the read above.
      if (event === "INITIAL_SESSION") return;
      void refresh();
    });

    // visibilitychange is dispatched at the Document. It was registered on
    // window once, which is not the reliable form.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") debouncedRefresh();
    };
    const handleOnline = () => debouncedRefresh();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refresh, debouncedRefresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "ok" || status === "needs_profile",
      ready: status !== "loading",
      refresh,
    }),
    [status, user, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
