"use client";

import { useContext, useState } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { Check, CheckCheck, Clock, Heart, LoaderCircle, Play } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { marksFor, saidAfter, tapOf, type MarkKey } from "@/lib/logging/marks";
import type { Status } from "@/lib/logging/titleState";
import type { LogTitle } from "@components/ds/LogItButton";

/**
 * Watched · Watch later · Favourite (a series: Watching · Finished · Watch
 * later · Favourite) — the first thing on every title, and the same on any
 * poster's quick sheet (ds/QuickMarks). The rules are lib/logging/marks.ts.
 *
 * Each is one tap, on or off, saved at once with Undo in the toast. Nothing
 * here asks for a date: a mark is "I've seen it", "I want to", "I love it".
 * The date, stars and who was there are "Add to diary", beside these.
 */
export function useMarks(title: LogTitle, { logged = false, onDiary }: { logged?: boolean; onDiary?: () => void } = {}) {
  const { user } = useAuth();
  const { getStatus, setStatus, togglePreference, hasFavorite, refreshPreferences } = useContext(UserPrefrenceContext);
  const [busy, setBusy] = useState<MarkKey | null>(null);
  const { itemId, itemType, itemName, imageUrl, genres, adult } = title;
  const status = (getStatus(itemId, itemType) ?? null) as Status;
  const favourite = hasFavorite(itemId);
  const state = { kind: itemType, status, favourite, logged };
  const marks = marksFor(state);
  const base = { itemId, mediaType: itemType, name: itemName, imgUrl: imageUrl ?? undefined, adult, genres };

  const writeStatus = (next: Status) => setStatus({ ...base, status: next, keepData: true, dated: false });
  const flipFavourite = (on: boolean) =>
    togglePreference({ ...base, funcType: "favorite", itemId: Number(itemId), adult: !!adult, genres: genres ?? [], currentState: !on, dated: false });

  const tap = async (key: MarkKey) => {
    if (!user || busy) return;
    const action = tapOf(state, key);
    if (action.do === "nothing") return;
    if (action.do === "logged") {
      // It's in the diary: that's a record, not a switch. Say where it lives.
      toast(onDiary ? "It's in your diary. Add another viewing, or remove one from your diary." : "It's in your diary — remove viewings there to unmark it.", { id: "marks-logged" });
      return;
    }
    const previous = status;
    const wasFavourite = favourite;
    setBusy(key);
    let ok = true;
    let message: string | undefined;
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
      if (ok) await refreshPreferences();
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

    const on = action.do === "favourite" ? action.on : action.do === "finish" ? true : marksFor({ ...state, status: action.status }).find((m) => m.key === key)?.on ?? false;
    const undo = async () => {
      // Back to exactly what was there: the status, and the favourite.
      if (action.do === "favourite") {
        await flipFavourite(!action.on);
        if (action.on && previous !== "watched") await writeStatus(previous);
      } else {
        await writeStatus(previous);
        if (wasFavourite !== hasFavorite(itemId)) await flipFavourite(wasFavourite);
      }
      await refreshPreferences();
    };
    toast.custom(
      (t) => (
        <div role="status" className="pointer-events-auto flex w-[min(92vw,26rem)] items-center gap-3 rounded-card border border-line-strong bg-overlay px-4 py-3 text-sm text-ink-0 shadow-2xl">
          <Check className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{saidAfter(key, on, itemType)}</span>
          {on && key === "watched" && onDiary && (
            <button
              type="button"
              className="shrink-0 rounded-full px-3 py-1.5 font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
              onClick={() => {
                toast.dismiss(t.id);
                onDiary();
              }}
            >
              Add date
            </button>
          )}
          {action.do !== "finish" && (
            <button
              type="button"
              className="shrink-0 rounded-full px-3 py-1.5 font-medium text-ink-400 transition-colors hover:bg-hover hover:text-ink-0"
              onClick={() => {
                toast.dismiss(t.id);
                void undo();
              }}
            >
              Undo
            </button>
          )}
        </div>
      ),
      { id: `marks-${itemType}-${itemId}`, duration: 6000 },
    );
  };

  return { signedIn: !!user, marks, tap, busy, status, favourite };
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
  onDiary,
  size = "lg",
}: {
  title: LogTitle;
  logged?: boolean;
  /** Opens the diary sheet (date, stars, who, words), offered after marking watched. */
  onDiary?: () => void;
  size?: "lg" | "md";
}) {
  const { signedIn, marks, tap, busy } = useMarks(title, { logged, onDiary });
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
