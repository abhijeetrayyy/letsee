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

export function useAuth() {
  return useContext(AuthContext);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Is there a Supabase auth cookie in the browser at all?
 *
 * Lets us tell "the server said anon while a token refresh was in flight" from
 * "this person is simply signed out". Retrying the first case avoids a false
 * logout; retrying the second would stall every anonymous visitor. The cookies
 * are not httpOnly — the browser client reads them the same way.
 */
function hasAuthCookie() {
  if (typeof document === "undefined") return false;
  // Must end at the cookie name: `sb-<ref>-auth-token`, optionally chunked
  // (`.0`, `.1`). A prefix match also caught
  // `sb-<ref>-auth-token-code-verifier`, the short-lived PKCE cookie written
  // when an auth flow *starts* — so a signed-out browser that had begun a
  // sign-in looked like it held a session, and the retry and self-heal below
  // both fired for someone who was simply logged out.
  return /(?:^|;\s*)sb-[^=;]*auth-token(?:\.\d+)?=/.test(document.cookie);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const fetchingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef(0);

  const fetchUser = useCallback(async (retry = false) => {
    if (fetchingRef.current && !retry) return;
    fetchingRef.current = true;

    const attempt = retry ? retryRef.current : 0;

    // A single "anon" answer used to flip the navbar straight to Log in. The
    // retry below was gated on `isRetry`, so it could only run once a retry
    // was already underway — nothing could ever start one. A token refresh
    // racing the request now costs a short delay instead of a false logout.
    const retryLater = async () => {
      retryRef.current = attempt + 1;
      fetchingRef.current = false;
      await sleep([400, 900, 1800][attempt] ?? 1800);
      await fetchUser(true);
    };

    try {
      const response = await fetch("/api/navbar", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`navbar request failed: ${response.status}`);
      const data = await response.json();
      const newStatus = (data?.status ?? "anon") as AuthStatus;

      if (newStatus === "anon" && attempt < 3 && hasAuthCookie()) {
        await retryLater();
        return;
      }

      setStatus(newStatus);
      setUser(data?.user ?? null);
      retryRef.current = 0;
    } catch {
      // A failed request says nothing about whether the session is valid, so
      // this one retries regardless of cookie state.
      if (attempt < 3) {
        await retryLater();
        return;
      }
      setStatus("anon");
      setUser(null);
      retryRef.current = 0;
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    // Trigger the SDK's own session refresh first so the cookie gets updated
    // before we read it via /api/navbar
    try {
      await supabase.auth.getSession();
    } catch {
      // SDK refresh might fail — proceed with navbar check anyway
    }
    await fetchUser();
  }, [fetchUser]);

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(refreshAuth, 150);
  }, [refreshAuth]);

  useEffect(() => {
    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      fetchUser();
    });

    const handleVisibility = () => {
      if (document.visibilityState === "visible") debouncedRefresh();
    };
    const handleFocus = () => debouncedRefresh();
    const handleOnline = () => debouncedRefresh();

    // visibilitychange is dispatched at the Document. It was registered on
    // window, which is not the reliable form.
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchUser, debouncedRefresh]);

  /**
   * Self-heal a false "signed out".
   *
   * Every other trigger here is an event — a tab switch, a focus, a token
   * refresh. Someone sitting on an open page generates none of them, so if the
   * client ever concluded "anon" while the cookie was still good (a request
   * racing a token refresh will do it), nothing re-checked and the header stayed
   * wrong until a manual reload. That is the "auth vanishes, refresh fixes it"
   * report.
   *
   * This only runs while the app believes you're signed out AND a Supabase
   * cookie is still present — a genuine sign-out clears the cookie, so it stops
   * immediately and never polls for anonymous visitors.
   */
  useEffect(() => {
    if (status !== "anon") return;
    if (!hasAuthCookie()) return;

    const timer = setInterval(() => {
      if (!hasAuthCookie()) return;
      void refreshAuth();
    }, 15000);

    return () => clearInterval(timer);
  }, [status, refreshAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "ok" || status === "needs_profile",
      ready: status !== "loading",
      refresh: refreshAuth,
    }),
    [status, user, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
