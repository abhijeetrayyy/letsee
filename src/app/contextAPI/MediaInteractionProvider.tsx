"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthProvider";

export type MediaStatus = "watchlist" | "watching" | "watched" | "on_hold" | "dropped" | null;

interface MediaState {
  /** itemId -> status */
  statuses: Record<string, MediaStatus>;
  /** Set of favorited itemIds */
  favorites: Set<string>;
  /** itemId -> rating (1-10) */
  ratings: Record<string, number>;
}

interface MediaInteractionContextValue {
  state: MediaState;
  loading: boolean;
  isAuthenticated: boolean;
  /** Set the status for an item. Pass null to remove. */
  setStatus: (itemId: string, status: MediaStatus | null, metadata?: {
    itemType?: string;
    name?: string;
    imgUrl?: string;
    adult?: boolean;
    genres?: string[];
  }) => Promise<boolean>;
  /** Toggle favorite independently of status. */
  toggleFavorite: (itemId: string, metadata?: {
    itemType?: string;
    name?: string;
    imgUrl?: string;
    adult?: boolean;
    genres?: string[];
  }) => Promise<boolean>;
  /** Set rating (1-10). Pass null to remove. */
  setRating: (itemId: string, score: number | null, itemType?: string) => Promise<boolean>;
  /** Get the status for an item. */
  getStatus: (itemId: string, itemType: string) => MediaStatus;
  /** Get whether an item is favorited. */
  isFavorited: (itemId: string, itemType: string) => boolean;
  /** Get the rating for an item. */
  getRating: (itemId: string, itemType: string) => number | null;
  /** Check if any action is in progress for this item. */
  isPending: (itemId: string) => boolean;
  /** Refresh all state from the server. */
  refresh: () => Promise<void>;
}

const defaultState: MediaState = { statuses: {}, favorites: new Set(), ratings: {} };

const MediaInteractionContext = createContext<MediaInteractionContextValue>({
  state: defaultState,
  loading: true,
  isAuthenticated: false,
  setStatus: async () => false,
  toggleFavorite: async () => false,
  setRating: async () => false,
  getStatus: () => null,
  isFavorited: () => false,
  getRating: () => null,
  isPending: () => false,
  refresh: async () => {},
});

/**
 * The key every client-side media map is built on.
 *
 * TMDB numbers films and series independently, so `550` is Fight Club *and* an
 * unrelated series. Keying on the bare id meant one silently shadowed the
 * other: whichever loaded last decided what both rendered. The server builds
 * the identical key in /api/user-media-status.
 */
export function mediaKey(itemId: string | number, itemType: string): string {
  return `${itemType === "tv" ? "tv" : "movie"}:${itemId}`;
}

export function useMediaInteraction() {
  return useContext(MediaInteractionContext);
}

async function apiCall(endpoint: string, method: string, body?: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function MediaInteractionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: hasSession, ready: authReady } = useAuth();
  const [state, setState] = useState<MediaState>(defaultState);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, favRes, ratingRes] = await Promise.all([
        fetch("/api/user-media-status", { credentials: "include" }),
        fetch("/api/userPrefrence", { credentials: "include", cache: "no-store" }),
        fetch("/api/user-rating", { credentials: "include" }),
      ]);

      if (!statusRes.ok) {
        setState(defaultState);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const statuses = await statusRes.json();
      const prefData = favRes.ok ? await favRes.json().catch(() => ({})) : {};
      const favList = prefData.favorite ?? [];
      const ratingData = ratingRes.ok ? await ratingRes.json().catch(() => ({})) : {};

      const favorites = new Set<string>();
      for (const item of favList) {
        if (item.item_id) favorites.add(mediaKey(item.item_id, item.item_type));
      }

      const ratings: Record<string, number> = {};
      for (const r of ratingData.ratings ?? ratingData.data ?? []) {
        if (r.item_id && r.score) ratings[mediaKey(r.item_id, r.item_type)] = r.score;
      }

      setState({ statuses: statuses || {}, favorites, ratings });
      setIsAuthenticated(true);
    } catch {
      setState(defaultState);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (hasSession) {
      refresh();
    } else {
      setState(defaultState);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [authReady, hasSession, refresh]);

  const setPending = (itemId: string) => {
    pendingRef.current.add(itemId);
  };
  const clearPending = (itemId: string) => {
    pendingRef.current.delete(itemId);
  };

  const setStatus = useCallback(
    async (itemId: string, status: MediaStatus | null, metadata?: Record<string, unknown>) => {
      setPending(itemId);
      // The optimistic write has to use the same composite key the server and
      // the accessors use, or a film's update lands under a series' entry.
      const itemType = (metadata?.itemType as string) === "tv" ? "tv" : "movie";
      const key = mediaKey(itemId, itemType);
      const prev = state.statuses[key];

      // Optimistic update
      setState((s) => {
        const next = { ...s.statuses };
        if (status === null) delete next[key];
        else next[key] = status;
        return { ...s, statuses: next };
      });

      try {
        if (status === null) {
          const ok = await apiCall(
            `/api/user-media-status?itemId=${encodeURIComponent(itemId)}&itemType=${itemType}`,
            "DELETE",
          );
          if (!ok) {
            setState((s) => {
              const next = { ...s.statuses };
              next[key] = prev;
              return { ...s, statuses: next };
            });
          }
          clearPending(itemId);
          return ok;
        }

        const ok = await apiCall("/api/user-media-status", "PUT", {
          itemId,
          status,
          itemType: metadata?.itemType || "movie",
          name: metadata?.name || "",
          imgUrl: metadata?.imgUrl || null,
          adult: metadata?.adult || false,
          genres: metadata?.genres || [],
        });

        if (!ok) {
          setState((s) => {
            const next = { ...s.statuses };
            next[key] = prev;
            return { ...s, statuses: next };
          });
        }

        clearPending(itemId);
        return ok;
      } catch {
        setState((s) => {
          const next = { ...s.statuses };
          next[key] = prev;
          return { ...s, statuses: next };
        });
        clearPending(itemId);
        return false;
      }
    },
    [state.statuses]
  );

  const toggleFavorite = useCallback(
    async (itemId: string, metadata?: Record<string, unknown>) => {
      setPending(itemId);
      const key = mediaKey(itemId, (metadata?.itemType as string) ?? "movie");
      const isFav = state.favorites.has(key);

      // Optimistic update
      setState((s) => {
        const next = new Set(s.favorites);
        if (isFav) next.delete(key);
        else next.add(key);
        return { ...s, favorites: next };
      });

      try {
        const endpoint = isFav ? "/api/deletefavoriteButton" : "/api/favoriteButton";
        const body = isFav
          ? { itemId, mediaType: metadata?.itemType || "movie" }
          : {
              itemId,
              name: metadata?.name || "",
              mediaType: metadata?.itemType || "movie",
              imgUrl: metadata?.imgUrl || null,
              adult: metadata?.adult || false,
              genres: metadata?.genres || [],
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        });

        if (!res.ok) {
          setState((s) => {
            const next = new Set(s.favorites);
            if (isFav) next.add(itemId);
            else next.delete(itemId);
            return { ...s, favorites: next };
          });
        }

        clearPending(itemId);
        return res.ok;
      } catch {
        setState((s) => {
          const next = new Set(s.favorites);
          if (isFav) next.add(itemId);
          else next.delete(itemId);
          return { ...s, favorites: next };
        });
        clearPending(itemId);
        return false;
      }
    },
    [state.favorites]
  );

  const setRating = useCallback(
    async (itemId: string, score: number | null, itemType?: string) => {
      setPending(itemId);
      const key = mediaKey(itemId, itemType ?? "movie");
      const prev = state.ratings[key];

      setState((s) => {
        const next = { ...s.ratings };
        if (score === null) delete next[key];
        else next[key] = score;
        return { ...s, ratings: next };
      });

      try {
        if (score === null) {
          const ok = await apiCall(`/api/user-rating?itemId=${encodeURIComponent(itemId)}&itemType=${itemType || "movie"}`, "DELETE");
          if (!ok) {
            setState((s) => {
              const next = { ...s.ratings };
              next[key] = prev;
              return { ...s, ratings: next };
            });
          }
          clearPending(itemId);
          return ok;
        }

        const ok = await apiCall("/api/user-rating", "POST", {
          itemId,
          itemType: itemType || "movie",
          score,
        });

        if (!ok) {
          setState((s) => {
            const next = { ...s.ratings };
            next[key] = prev;
            return { ...s, ratings: next };
          });
        }

        clearPending(itemId);
        return ok;
      } catch {
        setState((s) => {
          const next = { ...s.ratings };
          next[key] = prev;
          return { ...s, ratings: next };
        });
        clearPending(itemId);
        return false;
      }
    },
    [state.ratings]
  );

  const getStatus = useCallback((itemId: string, itemType: string): MediaStatus => {
    return state.statuses[mediaKey(itemId, itemType)] ?? null;
  }, [state.statuses]);

  const isFavorited = useCallback((itemId: string, itemType: string): boolean => {
    return state.favorites.has(mediaKey(itemId, itemType));
  }, [state.favorites]);

  const getRating = useCallback((itemId: string, itemType: string): number | null => {
    return state.ratings[mediaKey(itemId, itemType)] ?? null;
  }, [state.ratings]);

  const isPending = useCallback((itemId: string): boolean => {
    return pendingRef.current.has(String(itemId));
  }, []);

  const value = useMemo(
    () => ({
      state,
      loading,
      isAuthenticated,
      setStatus,
      toggleFavorite,
      setRating,
      getStatus,
      isFavorited,
      getRating,
      isPending,
      refresh,
    }),
    [state, loading, isAuthenticated, setStatus, toggleFavorite, setRating, getStatus, isFavorited, getRating, isPending, refresh]
  );

  return (
    <MediaInteractionContext.Provider value={value}>
      {children}
    </MediaInteractionContext.Provider>
  );
}
