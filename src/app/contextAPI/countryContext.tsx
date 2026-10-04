"use client";

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
} from "react";
import { useAuth } from "@/app/contextAPI/AuthProvider";

const STORAGE_KEY = "letsee_watch_country";

interface CountryContextType {
  country: string;
  setCountry: (code: string) => void;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState<string>("US");

  /**
   * The account's region beats the "US" default.
   *
   * `users.watch_region` has existed since migration 056 — whose own comment
   * cites the India-vs-US divergence as the reason it was added — and it was
   * read by the recommendation routes and by nothing else. Where to Watch, the
   * one place on the site where the answer is the entire point, defaulted to
   * US and only moved if you found the country selector yourself.
   *
   * That is not a cosmetic default. Measured across fifteen titles, six
   * provider sets are COMPLETELY disjoint between US and IN — Oppenheimer is
   * Peacock in the US and JioHotstar in India — and Parasite has no US flatrate
   * at all while streaming in India, so the page rendered an empty panel for a
   * film you could watch. JioHotstar, Zee5, Sony Liv and aha never appear in US
   * results, so they were unreachable through this UI entirely.
   *
   * localStorage still wins: it is set only by an explicit choice in the
   * selector, and an explicit choice outranks a stored preference.
   */
  const { user } = useAuth();
  const accountRegion = user?.watch_region ?? null;

  /**
   * The region arrives with the auth snapshot, which already reads the
   * account's own row on every load. This used to be a separate fetch of
   * `/api/user/providers` from every page — including for signed-out
   * visitors, who could only get a 401: one function invocation per
   * anonymous page view, to learn nothing.
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.length === 2) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage does not exist during SSR; reading it in render desyncs hydration
        setCountryState(stored.toUpperCase());
        return;
      }
    } catch {
      // ignore
    }
    if (accountRegion && /^[A-Za-z]{2}$/.test(accountRegion)) setCountryState(accountRegion.toUpperCase());
  }, [accountRegion]);

  const setCountry = useCallback((code: string) => {
    const normalized = code.slice(0, 2).toUpperCase();
    setCountryState(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // ignore
    }
  }, []);

  return (
    <CountryContext.Provider value={{ country, setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry(): CountryContextType {
  const context = useContext(CountryContext);
  if (context === undefined) {
    throw new Error("useCountry must be used within a CountryProvider");
  }
  return context;
}
