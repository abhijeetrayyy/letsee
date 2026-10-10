"use client";

import { useContext, useState } from "react";
import { mutate as mutateSWR } from "swr";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { DETAILS_HINT, markToast } from "@components/ds/markToast";
import { Check, CheckCheck, Clock, Heart, LoaderCircle, Play } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { marksFor, saidAfter, tapOf, type MarkKey } from "@/lib/logging/marks";
import type { Status } from "@/lib/logging/titleState";
import type { LogTitle } from "@components/ds/LogItButton";
import { hasDiaryEntry } from "@/lib/db/viewings";
import { supabase } from "@/utils/supabase/client";

/** A Watch later row's plan, in the shape the status route takes back. */
async function readPlan(userId: string, itemId: string, itemType: "movie" | "tv") {
  const { data } = await supabase
    .from("user_media_status")
    .select("save_note, save_for, save_for_date, save_with_user_id, save_with_name")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle();
  if (!data) return null;
  return {
    saveNote: data.save_note ?? "",
    saveFor: data.save_for ?? null,
    saveForDate: data.save_for_date ?? "",
    saveWithUserId: data.save_with_user_id ?? "",
    saveWithName: data.save_with_user_id ? "" : (data.save_with_name ?? ""),
  };
}

/**
 * Watched · Watching · Watch later · Favourite (a series: Watching · Finished ·
 * Watch later · Favourite) — the first thing on every title, and the same on
 * any poster's quick sheet (ds/QuickMarks). The rules are lib/logging/marks.ts.
 *
 * Each is one tap, on or off, saved at once: a short toast says so, with Undo,
 * and where the details live (⋯). Nothing here asks for a date or offers the
 * diary — the owner (10 Oct 2026): "it should register watched without asking
 * every time". When, who, stars and words are in ⋯ (ds/LogSheet), any time.
 *
 * A tap that can't do anything says why instead of doing nothing: Watch later
 * on something you've seen, or Watched off on a title that's in your diary
 * (that opens the entry, where Remove from diary is).
 */
export function useMarks(
  title: LogTitle,
  {
    logged = false,
    onLoggedTap,
    onDone,
    where = "elsewhere",
  }: {
    logged?: boolean;
    /** Watched tapped while the diary has it: open the entry instead. */
    onLoggedTap?: () => void;
    /** After any tap that saved (a poster's sheet closes itself). */
    onDone?: () => void;
    /** Whether ⋯ is on this page (a title) or on the title's page. */
    where?: keyof typeof DETAILS_HINT;
  } = {},
) {
  const { user } = useAuth();
  const { getStatus, setStatus, togglePreference, hasFavorite, refreshPreferences, loading } = useContext(UserPrefrenceContext);
  const [busy, setBusy] = useState<MarkKey | null>(null);
  const { itemId, itemType, itemName, imageUrl, genres, adult } = title;
  const status = (getStatus(itemId, itemType) ?? null) as Status;
  const favourite = hasFavorite(itemId, itemType);
  const state = { kind: itemType, status, favourite, logged };
  const marks = marksFor(state);
  const base = { itemId, mediaType: itemType, name: itemName, imgUrl: imageUrl ?? undefined, adult, genres };

  const writeStatus = (next: Status) => setStatus({ ...base, status: next, keepData: true, dated: false });
  const flipFavourite = (on: boolean) =>
    togglePreference({ ...base, funcType: "favorite", itemId: Number(itemId), adult: !!adult, genres: genres ?? [], currentState: !on, dated: false });

  const tap = async (key: MarkKey) => {
    if (!user || busy) return;
    // Until your library has loaded, every mark reads "off": a tap then would
    // write over what's really there (Watch later on a film you've watched).
    if (loading) {
      toast("One moment — still loading your marks.", { id: "marks-loading", duration: 2000 });
      return;
    }
    const mark = marks.find((m) => m.key === key);
    if (mark?.disabled) {
      toast(`${mark.disabled} — Watch later is for what you haven't seen.`, { id: "marks-disabled", duration: 3000 });
      return;
    }
    let action = tapOf(state, key);
    if (action.do === "nothing") return;
    // Watched off where the diary wasn't loaded (search rows, posters): ask it first.
    if (key === "watched" && action.do === "status" && action.status === null && !logged) {
      setBusy(key);
      const inDiary = await hasDiaryEntry(user.id, itemId, itemType);
      setBusy(null);
      if (inDiary) action = { do: "logged" };
    }
    if (action.do === "logged") {
      // It's in the diary: that's a record, not a switch. Show the entry.
      if (onLoggedTap) onLoggedTap();
      else toast("It's in your diary. Open its page to change or remove the entry.", { id: "marks-logged", duration: 3000 });
      return;
    }
    const previous = status;
    const wasFavourite = favourite;
    setBusy(key);
    let ok = true;
    let message: string | undefined;
    /** Episodes Finished ticked that weren't before: what its Undo takes back. */
    let added: { season_number: number; episode_number: number }[] = [];
    /** Watch later's plan (why, when, with whom): taking it off deletes the row, so Undo puts the plan back too. */
    const plan = key === "later" && previous === "watchlist" ? await readPlan(user.id, itemId, itemType) : null;
    if (action.do === "status") {
      const r = await writeStatus(action.status);
      ok = r.ok;
      message = r.message;
    } else if (action.do === "finish") {
      const r = await fetch("/api/tv/complete-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: itemId, dated: false }),
      }).catch(() => null);
      ok = !!r?.ok;
      if (ok) added = ((await r!.json().catch(() => null)) as { added?: typeof added } | null)?.added ?? [];
      // Every episode is marked now: the title's next-episode button and
      // progress read this key, and would otherwise offer one already marked.
      if (ok) await Promise.all([refreshPreferences(), mutateSWR(`/api/watched-episodes?showId=${itemId}`)]);
    } else {
      const r = await flipFavourite(action.on);
      ok = r.ok;
      message = r.message;
    }
    setBusy(null);
    if (!ok) {
      toast.error(message ?? "That didn't save. Check your connection and try again.");
      return;
    }
    onDone?.();

    const on = action.do === "favourite" ? action.on : action.do === "finish" ? true : marksFor({ ...state, status: action.status }).find((m) => m.key === key)?.on ?? false;
    const episodesKey = `/api/watched-episodes?showId=${itemId}`;
    const undo = async () => {
      // Back to exactly what was there: the status, and the favourite.
      if (action.do === "finish") {
        if (added.length) {
          await fetch("/api/watched-episodes-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ showId: itemId, episodes: added, action: "unmark" }),
          }).catch(() => null);
        }
        await writeStatus(previous);
        if (wasFavourite) await flipFavourite(true);
        await Promise.all([refreshPreferences(), mutateSWR(episodesKey)]);
        return;
      }
      if (plan) {
        await fetch("/api/user-media-status", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, itemType, status: "watchlist", name: itemName, imgUrl: imageUrl ?? "", genres: genres ?? [], adult: !!adult, ...plan }),
        }).catch(() => null);
        await refreshPreferences();
        return;
      }
      if (action.do === "favourite") {
        await flipFavourite(!action.on);
        if (action.on && previous !== "watched") await writeStatus(previous);
      } else {
        await writeStatus(previous);
        // Clearing a status also clears its favourite (api/user-media-status
        // DELETE), so a favourite there before is put back. Adding is add-only:
        // one that survived isn't toggled away.
        if (wasFavourite) await flipFavourite(true);
      }
      await refreshPreferences();
    };
    // Favouriting something unmarked (or only saved for later) marks it watched too (api/favoriteButton).
    const promoted = key === "favourite" && on && (previous === null || previous === "watchlist");
    const seen = on && (key === "watched" || key === "finished" || promoted);
    markToast({
      id: `marks-${itemType}-${itemId}`,
      text: promoted ? `Added to favourites, and marked ${itemType === "tv" ? "finished" : "watched"}` : saidAfter(key, on, itemType),
      hint: seen ? DETAILS_HINT[where] : undefined,
      undo: () => void undo(),
    });
  };

  return { signedIn: !!user, marks, tap, busy, status, favourite, loading };
}

const ICONS: Record<MarkKey, typeof Check> = {
  watched: Check,
  watching: Play,
  finished: CheckCheck,
  later: Clock,
  favourite: Heart,
};

export default function MarkTiles({
  title,
  logged = false,
  onLoggedTap,
  onDone,
  where = "elsewhere",
  size = "lg",
}: {
  title: LogTitle;
  logged?: boolean;
  onLoggedTap?: () => void;
  onDone?: () => void;
  where?: "here" | "elsewhere";
  size?: "lg" | "md";
}) {
  const { signedIn, marks, tap, busy } = useMarks(title, { logged, onLoggedTap, onDone, where });
  const pathname = usePathname() ?? "/app";
  const cols = marks.length === 4 ? "grid-cols-4" : "grid-cols-3";
  const height = size === "lg" ? "h-16" : "h-14";
  // Four across a phone leaves "Watch later" no room at the usual size.
  const text = marks.length === 4 ? "text-xs sm:text-sm" : "text-sm";

  if (!signedIn) {
    return (
      <div className={`grid ${cols} gap-2`}>
        {marks.map((m) => {
          const Icon = ICONS[m.key];
          return (
            <Link
              key={m.key}
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className={`flex ${height} flex-col items-center justify-center gap-1 rounded-card ${text} font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0`}
            >
              <Icon className="size-5" aria-hidden />
              {m.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Mark this title" className={`grid ${cols} gap-2`}>
      {marks.map((m) => {
        const Icon = ICONS[m.key];
        const working = busy === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => void tap(m.key)}
            aria-pressed={m.on}
            aria-disabled={!!m.disabled || undefined}
            disabled={working}
            title={m.disabled ?? undefined}
            className={`flex ${height} min-w-0 flex-col items-center justify-center gap-1 rounded-card px-1 ${text} font-medium transition-colors ${
              m.on
                ? "bg-action text-on-action hover:bg-action-hover"
                : m.disabled
                  ? "cursor-not-allowed text-ink-500 ring-1 ring-inset ring-line"
                  : "text-ink-100 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
            }`}
          >
            {working ? (
              <LoaderCircle className="size-5 animate-spin" aria-hidden />
            ) : (
              <Icon className={`size-5 ${m.on && (m.key === "favourite" || m.key === "watching") ? "fill-current" : ""}`} aria-hidden />
            )}
            <span className="max-w-full truncate">{m.label}</span>
            {m.disabled && <span className="sr-only">: {m.disabled}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The same marks as small round icons, for a row in a list (the bar's Add
 * sheet): ✓ ◷ ♥ — or ▶ ✓✓ ◷ ♥ for a series — each labelled for touch and
 * screen readers, each one tap. For marking one title after another.
 */
export function MarkIcons({ title, logged = false }: { title: LogTitle; logged?: boolean }) {
  const { signedIn, marks, tap, busy } = useMarks(title, { logged });
  if (!signedIn) return null;
  return (
    <div role="group" aria-label={`Mark ${title.itemName}`} className="flex shrink-0 items-center gap-1">
      {marks.map((m) => {
        const Icon = ICONS[m.key];
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => void tap(m.key)}
            aria-pressed={m.on}
            aria-label={m.disabled ? `${m.label}: ${m.disabled}` : m.label}
            aria-disabled={!!m.disabled || undefined}
            title={m.disabled ?? m.label}
            disabled={busy === m.key}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${
              m.on
                ? "bg-action text-on-action hover:bg-action-hover"
                : m.disabled
                  ? "cursor-not-allowed text-ink-600"
                  : "text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
            }`}
          >
            {busy === m.key ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Icon className={`size-4 ${m.on && (m.key === "favourite" || m.key === "watching") ? "fill-current" : ""}`} aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
