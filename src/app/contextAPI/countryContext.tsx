"use client";

import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
} from "react";

const STORAGE_KEY = "letsee_watch_country";

interface CountryContextType {
  country: string;
  setCountry: (code: string) => void;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState<string>("US");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.length === 2) {
        setCountryState(stored.toUpperCase());
      }
    } catch {
      // ignore
    }
  }, []);

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
