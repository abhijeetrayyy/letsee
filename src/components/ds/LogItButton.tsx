"use client";

import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Check, LoaderCircle } from "lucide-react";
import { DETAILS_HINT, markToast } from "@components/ds/markToast";
import toast from "react-hot-toast";
import Link from "@components/ui/AppLink";
import LogSheet, { type LoggedViewing } from "@components/ds/LogSheet";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { deleteMyViewing, logViewing } from "@/lib/db/viewings";

/**
 * Log it: one tap, saved for today, with Undo (docs/design/RETHINK.md §8,
 * "Mark as watched"; research/05 recommendation c). Up next's ✓ — something
 * you lined up, just watched.
 *
 * The tap saves straight away — no form stands between watching something and
 * it being in the diary. The toast says so briefly, with Undo, and that the
 * day and who was there can be changed from ⋯ (owner, 10 Oct 2026: register,
 * don't ask). Undo removes the viewing and puts the title's status back.
 */
export type LogTitle = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl?: string | null;
  genres?: string[];
  adult?: boolean;
};

type Callbacks = { onLogged?: (viewing: LoggedViewing) => void; onUndone?: () => void };

/** The logging itself, shared by the full button and the compact check on rows and posters. */
export function useLogIt(title: LogTitle, { onLogged, onUndone }: Callbacks = {}) {
  const { user } = useAuth();
  const { getStatus, setStatus, refreshPreferences } = useContext(UserPrefrenceContext);
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState<LoggedViewing | null>(null);
  const details = useDetails(title);
  const { itemId, itemType, itemName, imageUrl, genres, adult } = title;

  const undo = async (viewing: LoggedViewing, previous: ReturnType<typeof getStatus>) => {
    if (!user) return;
    const error = await deleteMyViewing(user.id, viewing.id);
    if (error) {
      toast.error(error);
      return;
    }
    // The log marked it watched; put back whatever it was before.
    if (previous !== "watched") {
      await setStatus({ itemId, status: previous, mediaType: itemType, name: itemName, imgUrl: imageUrl ?? undefined, genres, adult, keepData: true });
    }
    setLogged(null);
    await refreshPreferences();
    onUndone?.();
    toast.success("Taken out of your diary");
  };

  const log = async () => {
    if (busy || !user) return;
    setBusy(true);
    const previous = getStatus(itemId, itemType);
    const { viewing, error } = await logViewing({ itemId, itemType, itemName, imageUrl, genres, adult });
    setBusy(false);
    if (error || !viewing) {
      toast.error(error ?? "Couldn't log that.");
      return;
    }
    const saved: LoggedViewing = { id: viewing.id, watchedOn: viewing.watchedOn, place: viewing.place, companions: viewing.companions };
    setLogged(saved);
    onLogged?.(saved);
    void refreshPreferences();
    markToast({
      text: "Watched today — it's in your diary",
      hint: DETAILS_HINT.elsewhere,
      undo: () => void undo(saved, previous),
    });
  };

  return { signedIn: !!user, busy, logged, log, openDetails: () => details.open(logged), sheet: details.sheet };
}

/**
 * The details sheet (ds/LogSheet) for one title: open it on an entry, on
 * nothing yet, or for another viewing. Opening writes nothing — the sheet adds
 * to the diary only once you give it a day. The entry it opens with is held
 * here, fixed until it closes, so a list refetching underneath can't reset it.
 */
export function useDetails(title: LogTitle, { onChanged }: { onChanged?: (entry: LoggedViewing | null) => void } = {}) {
  const { user } = useAuth();
  const [state, setState] = useState<{ open: boolean; viewing: LoggedViewing | null; again: boolean }>({ open: false, viewing: null, again: false });
  const open = (viewing: LoggedViewing | null = null, { again = false }: { again?: boolean } = {}) => setState({ open: true, viewing, again });
  const sheet = user ? (
    <LogSheet
      open={state.open}
      onClose={() => setState((s) => ({ ...s, open: false }))}
      userId={user.id}
      viewing={state.viewing}
      again={state.again}
      itemId={title.itemId}
      itemType={title.itemType}
      itemName={title.itemName}
      imageUrl={title.imageUrl}
      genres={title.genres}
      adult={title.adult}
      onChanged={onChanged}
    />
  ) : null;
  return { open, sheet };
}

export default function LogItButton({
  size = "md",
  label = "Add to diary",
  quiet = false,
  className = "",
  onLogged,
  onUndone,
  ...title
}: LogTitle & { size?: "sm" | "md"; label?: string; quiet?: boolean; className?: string } & Callbacks) {
  const { signedIn, busy, logged, log, openDetails, sheet } = useLogIt(title, { onLogged, onUndone });
  // The router's path, not `window`: the server and the browser must render the same link.
  const pathname = usePathname() ?? "/app";
  const height = size === "sm" ? "h-9 px-4 text-sm" : "h-11 px-5 text-base";
  const base = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors ${height} ${className}`;

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={`${base} bg-action text-on-action hover:bg-action-hover`}>
        <Plus className="size-4" aria-hidden />
        Sign in to mark it
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={logged ? openDetails : () => void log()}
        disabled={busy}
        className={`${base} ${quiet ? "font-medium text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover" : "bg-action text-on-action hover:bg-action-hover"} disabled:opacity-60`}
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : logged ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {logged ? "In your diary · add details" : label}
      </button>
      {sheet}
    </>
  );
}

/**
 * The same log as a round check, for a row or a poster: "anything can be
 * marked watched from its row, optimistically, with Undo" (PAGES.md §3).
 */
export function LogCheck({
  title,
  onLogged,
  onUndone,
  overlay = false,
  className = "",
}: { title: LogTitle; overlay?: boolean; className?: string } & Callbacks) {
  const { signedIn, busy, logged, log, openDetails, sheet } = useLogIt(title, { onLogged, onUndone });
  if (!signedIn) return null;
  return (
    <>
      <button
        type="button"
        onClick={logged ? openDetails : () => void log()}
        disabled={busy}
        aria-label={logged ? `Logged ${title.itemName}. Add details` : `Log ${title.itemName} as watched today`}
        className={`flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
          logged
            ? "bg-action text-on-action"
            : overlay
              ? "bg-page/70 text-ink-300 hover:bg-page hover:text-ink-0"
              : "text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover"
        } ${overlay ? "size-7" : "size-9"} ${className}`}
      >
        {busy ? (
          <LoaderCircle className={`${overlay ? "size-3.5" : "size-4"} animate-spin`} aria-hidden />
        ) : (
          <Check className={overlay ? "size-3.5" : "size-4"} aria-hidden />
        )}
      </button>
      {sheet}
    </>
  );
}
