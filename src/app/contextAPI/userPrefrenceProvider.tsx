"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UserPrefrenceContext, {
  defaultPreferenceState,
  type PendingAction,
  type PendingActionItem,
  PreferenceItem,
  type PreferenceType,
  TogglePreferencePayload,
  TogglePreferenceResult,
  UserPreferenceState,
} from "./userPrefrence";
import { supabase } from "@/utils/supabase/client";

const normalizeId = (value: string | number): string => String(value);

const API_ENDPOINTS: Record<
  PreferenceType,
  { add: string; remove: string }
> = {
  watched: { add: "/api/watchedButton", remove: "/api/deletewatchedButton" },
  watchlater: { add: "/api/watchlistButton", remove: "/api/deletewatchlistButton" },
  favorite: { add: "/api/favoriteButton", remove: "/api/deletefavoriteButton" },
};

function applyUpdate(
  prev: UserPreferenceState,
  payload: TogglePreferencePayload
): UserPreferenceState {
  const { funcType, itemId, currentState } = payload;
  const key = normalizeId(itemId);

  const removeFrom = (list: PreferenceItem[]) =>
    list.filter((item) => item.item_id !== key);
  const addTo = (list: PreferenceItem[]) =>
    list.some((item) => item.item_id === key)
      ? list
      : [...list, { item_id: key }];

  const next: UserPreferenceState = {
    watched: [...prev.watched],
    favorite: [...prev.favorite],
    watchlater: [...prev.watchlater],
  };

  if (funcType === "watched") {
    if (currentState) {
      next.watched = removeFrom(next.watched);
      next.favorite = removeFrom(next.favorite);
    } else {
      next.watchlater = removeFrom(next.watchlater);
      next.watched = addTo(next.watched);
    }
  } else if (funcType === "favorite") {
    if (currentState) {
      next.favorite = removeFrom(next.favorite);
    } else {
      next.watchlater = removeFrom(next.watchlater);
      next.watched = removeFrom(next.watched);
      next.favorite = addTo(next.favorite);
    }
  } else if (funcType === "watchlater") {
    if (currentState) {
      next.watchlater = removeFrom(next.watchlater);
    } else {
      next.watched = removeFrom(next.watched);
      next.favorite = removeFrom(next.favorite);
      next.watchlater = addTo(next.watchlater);
    }
  }

  return next;
}

type QueuedItem = {
  payload: TogglePreferencePayload;
  resolve: (result: TogglePreferenceResult) => void;
  reject: (err: unknown) => void;
};

const RETRY_DELAY_MS = 400;

const UserPrefrenceProvider = ({ children }: { children: React.ReactNode }) => {
  const [userPrefrence, setUserPrefrence] = useState<UserPreferenceState>(
    defaultPreferenceState
  );
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);
  const [user, setUser] = useState(false);

  const queueRef = useRef<QueuedItem[]>([]);
  const processingRef = useRef(false);

  const refreshPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/userPrefrence", { cache: "no-store" });
      if (!response.ok) {
        setUserPrefrence(defaultPreferenceState);
        setUser(false);
        return;
      }
      const res = await response.json();
      const normalize = (items: { item_id?: string | number }[] = []): PreferenceItem[] =>
        (items ?? []).map((item) => ({
          item_id: normalizeId(item.item_id ?? ""),
        }));
      setUserPrefrence({
        watched: normalize(res?.watched),
        favorite: normalize(res?.favorite),
        watchlater: normalize(res?.watchlater),
      });
      setUser(true);
    } catch (error) {
      console.error("Failed to refresh preferences:", error);
      setUserPrefrence(defaultPreferenceState);
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (isMounted && userData?.user) {
        await refreshPreferences();
      } else if (isMounted) {
        setUserPrefrence(defaultPreferenceState);
        setUser(false);
        setLoading(false);
      }
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        refreshPreferences();
      } else {
        setUserPrefrence(defaultPreferenceState);
        setUser(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshPreferences]);

  const hasWatched = useCallback(
    (itemId: number | string) =>
      userPrefrence.watched.some((item) => item.item_id === normalizeId(itemId)),
    [userPrefrence.watched]
  );
  const hasFavorite = useCallback(
    (itemId: number | string) =>
      userPrefrence.favorite.some(
        (item) => item.item_id === normalizeId(itemId)
      ),
    [userPrefrence.favorite]
  );
  const hasWatchLater = useCallback(
    (itemId: number | string) =>
      userPrefrence.watchlater.some(
        (item) => item.item_id === normalizeId(itemId)
      ),
    [userPrefrence.watchlater]
  );

  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) return;

    const item = queueRef.current.shift()!;
    const { payload, resolve } = item;
    const { itemId, funcType } = payload;

    processingRef.current = true;

    const endpoint = payload.currentState
      ? API_ENDPOINTS[funcType].remove
      : API_ENDPOINTS[funcType].add;

    const previousState = userPrefrence;
    setUserPrefrence((prev) => applyUpdate(prev, payload));

    const body: Record<string, unknown> = {
      itemId: payload.itemId,
      name: payload.name,
      mediaType: payload.mediaType,
      imgUrl: payload.imgUrl,
      adult: payload.adult,
      genres: payload.genres,
    };
    if (funcType === "watched" && payload.currentState) {
      body.keepData = payload.keepData === true;
    }
    const doFetch = (): Promise<{ ok: boolean; message?: string }> =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            return { ok: false, message: data?.error ?? "Request failed" };
          }
          return { ok: true, message: data?.message };
        })
        .catch((err) => ({
          ok: false,
          message: (err as Error).message ?? "An error occurred while updating preference.",
        }));

    const removePending = () =>
      setPendingActions((prev) =>
        prev.filter((p) => !(p.itemId === itemId && p.funcType === funcType))
      );

    const finish = (result: TogglePreferenceResult, rollback: boolean) => {
      if (rollback) {
        setUserPrefrence(previousState);
      }
      removePending();
      processingRef.current = false;
      resolve(result);
      setTimeout(processQueue, 0);
    };

    const runOne = (): Promise<TogglePreferenceResult> =>
      doFetch().then((result) => {
        if (result.ok) {
          return refreshPreferences().then(() => result);
        }
        return result;
      });

    runOne()
      .then((result) => {
        if (result.ok) {
          finish(result, false);
        } else {
          setTimeout(() => {
            runOne().then((retryResult) => {
              if (retryResult.ok) {
                finish(retryResult, false);
              } else {
                finish(retryResult, true);
              }
            }).catch(() => {
              finish(
                { ok: false, message: "Request failed. Please try again." },
                true
              );
            });
          }, RETRY_DELAY_MS);
        }
      })
      .catch((err) => {
        setTimeout(() => {
          runOne()
            .then((retryResult) => {
              if (retryResult.ok) {
                finish(retryResult, false);
              } else {
                finish(
                  { ok: false, message: (retryResult.message ?? (err as Error).message) ?? "Request failed" },
                  true
                );
              }
            })
            .catch(() => {
              finish(
                { ok: false, message: (err as Error).message ?? "Request failed" },
                true
              );
            });
        }, RETRY_DELAY_MS);
      });
  }, [userPrefrence, refreshPreferences]);

  const togglePreference = useCallback(
    (payload: TogglePreferencePayload): Promise<TogglePreferenceResult> => {
      if (loading) {
        return Promise.resolve({
          ok: false,
          message: "Preferences are still loading.",
        });
      }
      if (!user) {
        return Promise.resolve({
          ok: false,
          message: "Please log in to perform this action.",
        });
      }

      return new Promise((resolve, reject) => {
        const { itemId, funcType } = payload;
        queueRef.current.push({ payload, resolve, reject });
        setPendingActions((prev) => [...prev, { itemId, funcType }]);
        processQueue();
      });
    },
    [loading, user, processQueue]
  );

  const pendingAction: PendingAction =
    pendingActions.length > 0 ? pendingActions[0]! : null;

  const value = useMemo(
    () => ({
      userPrefrence,
      setUserPrefrence,
      loading,
      pendingAction,
      pendingActions,
      user,
      refreshPreferences,
      togglePreference,
      hasWatched,
      hasFavorite,
      hasWatchLater,
    }),
    [
      userPrefrence,
      loading,
      pendingAction,
      pendingActions,
      user,
      refreshPreferences,
      togglePreference,
      hasWatched,
      hasFavorite,
      hasWatchLater,
    ]
  );

  return (
    <UserPrefrenceContext.Provider value={value}>
      {children}
    </UserPrefrenceContext.Provider>
  );
};

export default UserPrefrenceProvider;
