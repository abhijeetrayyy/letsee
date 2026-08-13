"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import UserPrefrenceContext, {
  defaultPreferenceState,
  type PendingAction,
  type PendingActionItem,
  PreferenceItem,
  type PreferenceType,
  type MediaStatus,
  type SetStatusPayload,
  TogglePreferencePayload,
  TogglePreferenceResult,
  UserPreferenceState,
} from "./userPrefrence";
import { useAuth } from "./AuthProvider";

const normalizeId = (value: string | number): string => String(value);

const API_ENDPOINTS: Record<PreferenceType, { add: string; remove: string }> = {
  watched: { add: "/api/user-media-status", remove: "/api/user-media-status" },
  watchlater: {
    add: "/api/user-media-status",
    remove: "/api/user-media-status",
  },
  favorite: { add: "/api/favoriteButton", remove: "/api/deletefavoriteButton" },
  watching: { add: "/api/user-media-status", remove: "/api/user-media-status" },
};

function applyUpdate(
  prev: UserPreferenceState,
  payload: TogglePreferencePayload,
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
    watching: [...prev.watching],
    statuses: { ...prev.statuses },
  };

  // Favorite lives in its own table and is independent of status. It used to
  // clear watched/watching/watchlist here, which made "loved it" silently
  // erase "I watched it" until the next refresh corrected it.
  if (funcType === "favorite") {
    next.favorite = currentState ? removeFrom(next.favorite) : addTo(next.favorite);
    return next;
  }

  // The other three are three views of ONE column, so setting any of them
  // clears the other two by definition.
  const statusFor: Record<string, MediaStatus> = {
    watched: "watched",
    watchlater: "watchlist",
    watching: "watching",
  };

  next.watched = removeFrom(next.watched);
  next.watchlater = removeFrom(next.watchlater);
  next.watching = removeFrom(next.watching);

  if (currentState) {
    delete next.statuses[key];
  } else {
    next.statuses[key] = statusFor[funcType]!;
    if (funcType === "watched") next.watched = addTo(next.watched);
    else if (funcType === "watchlater") next.watchlater = addTo(next.watchlater);
    else next.watching = addTo(next.watching);
  }

  return next;
}

/** Rebuild the derived buckets after a direct status write. */
function applyStatus(
  prev: UserPreferenceState,
  itemId: string,
  status: MediaStatus | null,
): UserPreferenceState {
  const drop = (list: PreferenceItem[]) => list.filter((i) => i.item_id !== itemId);
  const next: UserPreferenceState = {
    watched: drop(prev.watched),
    favorite: [...prev.favorite],
    watchlater: drop(prev.watchlater),
    watching: drop(prev.watching),
    statuses: { ...prev.statuses },
  };

  if (status === null) {
    delete next.statuses[itemId];
    return next;
  }

  next.statuses[itemId] = status;
  if (status === "watched") next.watched.push({ item_id: itemId });
  else if (status === "watchlist") next.watchlater.push({ item_id: itemId });
  else if (status === "watching") next.watching.push({ item_id: itemId });
  // on_hold and dropped intentionally belong to no legacy bucket.

  return next;
}

type QueuedItem = {
  payload: TogglePreferencePayload;
  resolve: (result: TogglePreferenceResult) => void;
  reject: (err: unknown) => void;
};

const RETRY_DELAY_MS = 400;
const REQUEST_TIMEOUT_MS = 20000;

function getErrorMessage(
  response: Response | null,
  data: { error?: string } | null,
  networkError?: unknown,
): string {
  if (networkError instanceof Error) {
    if (networkError.name === "AbortError")
      return "Request timed out. Please try again.";
    if (
      networkError.message?.includes("fetch") ||
      networkError.message === "Failed to fetch"
    ) {
      return "Connection problem. Please check your network and try again.";
    }
    return networkError.message;
  }
  if (response) {
    if (response.status === 401) return "Session expired. Please log in again.";
    if (response.status >= 500)
      return "Server error. Please try again in a moment.";
    if (data?.error) return data.error;
    if (response.status === 400) return "Invalid request. Please try again.";
  }
  return "Request failed. Please try again.";
}

const UserPrefrenceProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, ready: authReady } = useAuth();
  const [userPrefrence, setUserPrefrence] = useState<UserPreferenceState>(
    defaultPreferenceState,
  );
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);
  const [user, setUser] = useState(false);

  const queueRef = useRef<QueuedItem[]>([]);
  const processingRef = useRef(false);

  const refreshPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/userPrefrence", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        setUserPrefrence(defaultPreferenceState);
        setUser(false);
        return;
      }
      const res = await response.json();
      const normalize = (
        items: { item_id?: string | number }[] = [],
      ): PreferenceItem[] =>
        (items ?? []).map((item) => ({
          item_id: normalizeId(item.item_id ?? ""),
        }));
      const statuses: Record<string, MediaStatus> = {};
      for (const [id, status] of Object.entries(res?.statuses ?? {})) {
        statuses[normalizeId(id)] = status as MediaStatus;
      }
      setUserPrefrence({
        watched: normalize(res?.watched),
        favorite: normalize(res?.favorite),
        watchlater: normalize(res?.watchlater),
        watching: normalize(res?.watching),
        statuses,
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

  // Driven entirely by the shared AuthProvider — it already owns the single
  // supabase.auth.getUser()/onAuthStateChange subscription and the
  // tab-focus/visibility re-check, so this just reacts to its verdict.
  useEffect(() => {
    if (!authReady) return;
    if (isAuthenticated) {
      refreshPreferences();
    } else {
      setUserPrefrence(defaultPreferenceState);
      setUser(false);
      setLoading(false);
    }
  }, [authReady, isAuthenticated, refreshPreferences]);

  const hasWatched = useCallback(
    (itemId: number | string) =>
      userPrefrence.watched.some(
        (item) => item.item_id === normalizeId(itemId),
      ),
    [userPrefrence.watched],
  );
  const hasFavorite = useCallback(
    (itemId: number | string) =>
      userPrefrence.favorite.some(
        (item) => item.item_id === normalizeId(itemId),
      ),
    [userPrefrence.favorite],
  );
  const hasWatchLater = useCallback(
    (itemId: number | string) =>
      userPrefrence.watchlater.some(
        (item) => item.item_id === normalizeId(itemId),
      ),
    [userPrefrence.watchlater],
  );
  const hasWatching = useCallback(
    (itemId: number | string) =>
      userPrefrence.watching.some(
        (item) => item.item_id === normalizeId(itemId),
      ),
    [userPrefrence.watching],
  );

  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) return;

    const item = queueRef.current.shift()!;
    const { payload, resolve } = item;
    const { itemId, funcType } = payload;

    processingRef.current = true;

    const previousState = userPrefrence;
    setUserPrefrence((prev) => applyUpdate(prev, payload));

    const statusMap: Record<string, string> = {
      watched: "watched",
      watchlater: "watchlist",
      watching: "watching",
    };

    const useNewApi = funcType !== "favorite";
    const method = useNewApi
      ? payload.currentState ? "DELETE" : "PUT"
      : "POST";
    const endpoint = useNewApi
      ? payload.currentState
        ? `/api/user-media-status?itemId=${encodeURIComponent(payload.itemId)}&keepData=${payload.keepData === false ? "false" : "true"}`
        : `/api/user-media-status`
      : payload.currentState
        ? API_ENDPOINTS[funcType].remove
        : API_ENDPOINTS[funcType].add;

    const body: Record<string, unknown> | undefined = useNewApi
      ? payload.currentState
        ? undefined
        : {
            itemId: payload.itemId,
            status: statusMap[funcType] || "watching",
            itemType: payload.mediaType,
            name: payload.name,
            imgUrl: payload.imgUrl,
            adult: payload.adult,
            genres: payload.genres,
          }
      : {
          itemId: payload.itemId,
          name: payload.name,
          mediaType: payload.mediaType,
          imgUrl: payload.imgUrl,
          adult: payload.adult,
          genres: payload.genres,
        };

    const doFetch = (): Promise<{ ok: boolean; message?: string }> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      return fetch(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
        signal: controller.signal,
      })
        .then(async (response) => {
          clearTimeout(timeoutId);
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          } | null;
          if (!response.ok) {
            return {
              ok: false,
              message: getErrorMessage(response, data, null),
            };
          }
          return { ok: true, message: data?.message };
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          return {
            ok: false,
            message: getErrorMessage(null, null, err),
          };
        });
    };

    const removePending = () =>
      setPendingActions((prev) =>
        prev.filter((p) => !(p.itemId === itemId && p.funcType === funcType)),
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
            runOne()
              .then((retryResult) => {
                if (retryResult.ok) {
                  finish(retryResult, false);
                } else {
                  finish(retryResult, true);
                }
              })
              .catch((retryErr) => {
                finish(
                  { ok: false, message: getErrorMessage(null, null, retryErr) },
                  true,
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
                  {
                    ok: false,
                    message:
                      retryResult.message ?? getErrorMessage(null, null, err),
                  },
                  true,
                );
              }
            })
            .catch((retryErr) => {
              finish(
                { ok: false, message: getErrorMessage(null, null, retryErr) },
                true,
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
    [loading, user, processQueue],
  );

  const getStatus = useCallback(
    (itemId: number | string): MediaStatus | null =>
      userPrefrence.statuses[normalizeId(itemId)] ?? null,
    [userPrefrence.statuses],
  );

  /**
   * Write the status column directly. togglePreference can only express the
   * three statuses that happen to have a button, so on_hold and dropped were
   * unreachable from the UI even though the column accepts them.
   */
  const setStatus = useCallback(
    async (payload: SetStatusPayload): Promise<TogglePreferenceResult> => {
      if (!user) {
        return { ok: false, message: "Please log in to perform this action." };
      }
      const key = normalizeId(payload.itemId);
      const previous = userPrefrence;
      setUserPrefrence((prev) => applyStatus(prev, key, payload.status));

      const pendingItem = { itemId: Number(payload.itemId), funcType: "watched" as PreferenceType };
      setPendingActions((prev) => [...prev, pendingItem]);

      try {
        const response =
          payload.status === null
            ? await fetch(
                `/api/user-media-status?itemId=${encodeURIComponent(key)}&keepData=${
                  payload.keepData === false ? "false" : "true"
                }`,
                { method: "DELETE", credentials: "include" },
              )
            : await fetch("/api/user-media-status", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  itemId: payload.itemId,
                  status: payload.status,
                  itemType: payload.mediaType,
                  name: payload.name,
                  imgUrl: payload.imgUrl,
                  adult: payload.adult ?? false,
                  genres: payload.genres ?? [],
                }),
              });

        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        } | null;

        if (!response.ok) {
          setUserPrefrence(previous);
          return { ok: false, message: getErrorMessage(response, data, null) };
        }

        await refreshPreferences();
        return { ok: true, message: data?.message };
      } catch (err) {
        setUserPrefrence(previous);
        return { ok: false, message: getErrorMessage(null, null, err) };
      } finally {
        setPendingActions((prev) =>
          prev.filter((p) => !(p.itemId === pendingItem.itemId && p.funcType === pendingItem.funcType)),
        );
      }
    },
    [user, userPrefrence, refreshPreferences],
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
      setStatus,
      getStatus,
      hasWatched,
      hasFavorite,
      hasWatchLater,
      hasWatching,
    }),
    [
      userPrefrence,
      loading,
      pendingAction,
      pendingActions,
      user,
      refreshPreferences,
      togglePreference,
      setStatus,
      getStatus,
      hasWatched,
      hasFavorite,
      hasWatchLater,
      hasWatching,
    ],
  );

  return (
    <UserPrefrenceContext.Provider value={value}>
      {children}
    </UserPrefrenceContext.Provider>
  );
};

export default UserPrefrenceProvider;
