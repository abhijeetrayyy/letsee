import { createContext } from "react";

/** Single list item; item_id normalized to string in state. */
export type PreferenceItem = {
  item_id: string;
};

export type UserPreferenceState = {
  watched: PreferenceItem[];
  favorite: PreferenceItem[];
  watchlater: PreferenceItem[];
};

export type PreferenceType = "watched" | "watchlater" | "favorite";

export type TogglePreferencePayload = {
  funcType: PreferenceType;
  itemId: number;
  name: string;
  mediaType: string;
  imgUrl: string;
  adult: boolean;
  genres: string[];
  currentState: boolean;
};

export type TogglePreferenceResult = {
  ok: boolean;
  message?: string;
};

/** Which button is currently pending (loading). */
export type PendingAction = {
  itemId: number;
  funcType: PreferenceType;
} | null;

export type UserPreferenceContextValue = {
  /** Current lists (item_id as string). */
  userPrefrence: UserPreferenceState;
  setUserPrefrence: React.Dispatch<React.SetStateAction<UserPreferenceState>>;
  /** Initial load of preferences from API. */
  loading: boolean;
  /** Which item+type is currently toggling (for per-button loading). */
  pendingAction: PendingAction;
  /** User is logged in and preferences are available. */
  user: boolean;
  /** Reload preferences from server. */
  refreshPreferences: () => Promise<void>;
  /** Toggle add/remove; uses optimistic update, reverts on failure. */
  togglePreference: (payload: TogglePreferencePayload) => Promise<TogglePreferenceResult>;
  /** Helpers so consumers don't duplicate list checks. */
  hasWatched: (itemId: number | string) => boolean;
  hasFavorite: (itemId: number | string) => boolean;
  hasWatchLater: (itemId: number | string) => boolean;
};

export const defaultPreferenceState: UserPreferenceState = {
  watched: [],
  favorite: [],
  watchlater: [],
};

const noopAsync = async (): Promise<TogglePreferenceResult> => ({ ok: false });

const noopBool = () => false;

const UserPrefrenceContext = createContext<UserPreferenceContextValue>({
  userPrefrence: defaultPreferenceState,
  setUserPrefrence: () => undefined,
  loading: true,
  pendingAction: null,
  user: false,
  refreshPreferences: async () => undefined,
  togglePreference: noopAsync,
  hasWatched: noopBool,
  hasFavorite: noopBool,
  hasWatchLater: noopBool,
});

export default UserPrefrenceContext;
