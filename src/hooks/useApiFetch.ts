"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UseApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  /** Include cookies (e.g. for auth). Default false. */
  credentials?: RequestCredentials;
  /** If false, the request is not sent (e.g. wait for user input). */
  enabled?: boolean;
  /** Dependencies that trigger a refetch when changed (e.g. [id]). */
  deps?: unknown[];
};

export type UseApiFetchResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

/**
 * Client-side fetch hook for calling your /api routes.
 * - Loading and error state for UX (skeletons, error messages, retry).
 * - Aborts on unmount; parses API error body (body.error).
 */
export function useApiFetch<T = unknown>(
  url: string | null,
  options: UseApiFetchOptions = {}
): UseApiFetchResult<T> {
  const {
    method = "GET",
    body,
    headers = {},
    credentials,
    enabled = true,
    deps = [],
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async () => {
    if (!url || !enabled) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, {
        method,
        signal: abortRef.current.signal,
        credentials,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body != null && method !== "GET"
          ? { body: JSON.stringify(body) }
          : {}),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          json?.error ?? json?.message ?? `Request failed (${res.status})`;
        setError(typeof message === "string" ? message : "Request failed");
        setData(null);
        return;
      }

      setData(json as T);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "Something went wrong");
      setData(null);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [url, enabled, method, credentials, JSON.stringify(body), ...deps]);

  useEffect(() => {
    if (!enabled) return;
    doFetch();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [doFetch, enabled]);

  return { data, error, loading, refetch: doFetch };
}
