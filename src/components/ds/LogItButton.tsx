"use client";

import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Check, LoaderCircle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "@components/ui/AppLink";
import LogSheet, { type LoggedViewing } from "@components/ds/LogSheet";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { deleteMyViewing, logViewing } from "@/lib/db/viewings";

/**
 * Log it: one tap, saved for today, with Undo (docs/design/RETHINK.md §8,
 * "Mark as watched"; research/05 recommendation c).
 *
 * The tap saves straight away — no form stands between watching something and
 * it being in the diary. The toast that follows offers *Add details* (when,
 * who was there, a rating, your words) and *Undo*. Undo removes the viewing
 * and puts the title's status back the way it was.
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
  const [sheetOpen, setSheetOpen] = useState(false);
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

  /**
   * `details`: straight into the sheet (when, stars, who, words) — the
   * "Add to diary" under the marks — rather than the toast offering it.
   */
  const log = async ({ details = false }: { details?: boolean } = {}) => {
    if (busy || !user) return;
    setBusy(true);
    const previous = getStatus(itemId, itemType);
    const { viewing, error } = await logViewing({ itemId, itemType, itemName, imageUrl, genres, adult });
    setBusy(false);
    if (error || !viewing) {
      toast.error(error ?? "Couldn't log that.");
      return;
    }
    const saved: LoggedViewing = { id: viewing.id, watchedOn: viewing.watchedOn };
    setLogged(saved);
    onLogged?.(saved);
    void refreshPreferences();
    if (details) {
      setSheetOpen(true);
      return;
    }
    toast.custom(
      (t) => (
        <div
          role="status"
          className="pointer-events-auto flex w-[min(92vw,26rem)] items-center gap-3 rounded-card border border-line-strong bg-overlay px-4 py-3 text-sm text-ink-0 shadow-2xl"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            In your diary <span className="text-ink-500">· today</span>
          </span>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
            onClick={() => {
              toast.dismiss(t.id);
              setSheetOpen(true);
            }}
          >
            Add details
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 font-medium text-ink-400 transition-colors hover:bg-hover hover:text-ink-0"
            onClick={() => {
              toast.dismiss(t.id);
              void undo(saved, previous);
            }}
          >
            Undo
          </button>
        </div>
      ),
      { duration: 7000 },
    );
  };

  const sheet = user ? (
    <LogSheet
      open={sheetOpen}
      onClose={() => setSheetOpen(false)}
      userId={user.id}
      viewing={logged}
      itemId={itemId}
      itemType={itemType}
      itemName={itemName}
      imageUrl={imageUrl}
      genres={genres}
    />
  ) : null;

  return { signedIn: !!user, busy, logged, log, openDetails: () => setSheetOpen(true), sheet };
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
