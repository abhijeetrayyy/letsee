"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import UserPrefrenceContext, {
  defaultPreferenceState,
  PendingAction,
  PreferenceItem,
  TogglePreferencePayload,
  TogglePreferenceResult,
  UserPreferenceState,
} from "./userPrefrence";
import { supabase } from "@/utils/supabase/client";

const normalizeId = (value: string | number): string => String(value);

const API_ENDPOINTS = {
  watched: { add: "/api/watchedButton", remove: "/api/deletewatchedButton" },
  watchlater: { add: "/api/watchlistButton", remove: "/api/deletewatchlistButton" },
  favorite: { add: "/api/favoriteButton", remove: "/api/deletefavoriteButton" },
} as const;

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

const UserPrefrenceProvider = ({ children }: { children: React.ReactNode }) => {
  const [userPrefrence, setUserPrefrence] = useState<UserPreferenceState>(
    defaultPreferenceState
  );
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [user, setUser] = useState(false);

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

  const togglePreference = useCallback(
    async (payload: TogglePreferencePayload): Promise<TogglePreferenceResult> => {
      if (loading) {
        return { ok: false, message: "Preferences are still loading." };
      }
      if (!user) {
        return { ok: false, message: "Please log in to perform this action." };
      }

      const { itemId, funcType } = payload;
      const endpoint = payload.currentState
        ? API_ENDPOINTS[funcType].remove
        : API_ENDPOINTS[funcType].add;

      const previousState = userPrefrence;
      setPendingAction({ itemId, funcType });

      setUserPrefrence((prev) => applyUpdate(prev, payload));

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: payload.itemId,
            name: payload.name,
            mediaType: payload.mediaType,
            imgUrl: payload.imgUrl,
            adult: payload.adult,
            genres: payload.genres,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setUserPrefrence(previousState);
          return {
            ok: false,
            message: data?.error ?? "Request failed",
          };
        }

        return { ok: true, message: data?.message };
      } catch (error) {
        setUserPrefrence(previousState);
        return {
          ok: false,
          message:
            (error as Error).message ??
            "An error occurred while updating preference.",
        };
      } finally {
        setPendingAction(null);
      }
    },
    [loading, user, userPrefrence]
  );

  const value = useMemo(
    () => ({
      userPrefrence,
      setUserPrefrence,
      loading,
      pendingAction,
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
