import { createContext } from "react";

/** Single list item; item_id normalized to string in state. */
export type PreferenceItem = {
  item_id: string;
};

export type UserPreferenceState = {
  watched: PreferenceItem[];
  favorite: PreferenceItem[];
  watchlater: PreferenceItem[];
  watching: PreferenceItem[];
  /** item_id → status. The authoritative view; the buckets above are derived
      from it and kept only for existing consumers. */
  statuses: Record<string, MediaStatus>;
};

export type PreferenceType = "watched" | "watchlater" | "favorite" | "watching";

/** The five values `user_media_status.status` can hold. */
export const MEDIA_STATUSES = [
  "watchlist",
  "watching",
  "watched",
  "on_hold",
  "dropped",
] as const;

export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export type SetStatusPayload = {
  itemId: number | string;
  /** null clears the status entirely (removes it from all lists). */
  status: MediaStatus | null;
  /**
   * Also the status map's key discriminator. The map is keyed `type:id`, so
   * without this a series files under a film's key — writing `movie:1399` and
   * reading back `tv:1399`, with TV status quietly never appearing.
   */
  mediaType: string;
  name: string;
  imgUrl?: string;
  adult?: boolean;
  genres?: string[];
  /** Only meaningful when clearing a "watched" status. */
  keepData?: boolean;
};

export type TogglePreferencePayload = {
  funcType: PreferenceType;
  itemId: number;
  name: string;
  /** Also the status map's key discriminator — see SetStatusPayload. */
  mediaType: string;
  imgUrl?: string;
  adult: boolean;
  genres: string[];
  currentState: boolean;
  /** When removing from watched: if true, keep rating, diary and public review (soft unwatch). */
  keepData?: boolean;
};

export type TogglePreferenceResult = {
  ok: boolean;
  message?: string;
};

/** One pending action (in queue or in flight). */
export type PendingActionItem = {
  itemId: number;
  funcType: PreferenceType;
};

/** All actions currently in queue or in flight (for per-button loading). */
export type PendingAction = PendingActionItem | null;

/** @deprecated Use pendingActions array; null for backward compat. */
export type PendingActionLegacy = PendingActionItem | null;

export type UserPreferenceContextValue = {
  /** Current lists (item_id as string). */
  userPrefrence: UserPreferenceState;
  setUserPrefrence: React.Dispatch<React.SetStateAction<UserPreferenceState>>;
  /** Initial load of preferences from API. */
  loading: boolean;
  /** Which item+type is currently toggling (for per-button loading). Single for backward compat. */
  pendingAction: PendingAction;
  /** All item+type in queue or in flight (use this to show loading on multiple buttons). */
  pendingActions: PendingActionItem[];
  /** User is logged in and preferences are available. */
  user: boolean;
  /** Reload preferences from server. */
  refreshPreferences: () => Promise<void>;
  /** Toggle add/remove; uses optimistic update, reverts on failure. */
  togglePreference: (
    payload: TogglePreferencePayload,
  ) => Promise<TogglePreferenceResult>;
  /** Set or clear the single status field directly. Unlike togglePreference
      this can reach on_hold and dropped, which have no toggle button. */
  setStatus: (payload: SetStatusPayload) => Promise<TogglePreferenceResult>;
  /** Current status for an item, or null if untracked. */
  getStatus: (itemId: number | string, itemType?: string) => MediaStatus | null;
  /** Helpers so consumers don't duplicate list checks. */
  hasWatched: (itemId: number | string) => boolean;
  hasFavorite: (itemId: number | string) => boolean;
  hasWatchLater: (itemId: number | string) => boolean;
  hasWatching: (itemId: number | string) => boolean;
};

export const defaultPreferenceState: UserPreferenceState = {
  watched: [],
  favorite: [],
  watchlater: [],
  watching: [],
  statuses: {},
};

const noopAsync = async (): Promise<TogglePreferenceResult> => ({ ok: false });

const noopBool = () => false;

const UserPrefrenceContext = createContext<UserPreferenceContextValue>({
  userPrefrence: defaultPreferenceState,
  setUserPrefrence: () => undefined,
  loading: true,
  pendingAction: null,
  pendingActions: [],
  user: false,
  refreshPreferences: async () => undefined,
  togglePreference: noopAsync,
  setStatus: noopAsync,
  getStatus: () => null,
  hasWatched: noopBool,
  hasFavorite: noopBool,
  hasWatchLater: noopBool,
  hasWatching: noopBool,
});

export default UserPrefrenceContext;
