"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { CalendarDays, Loader2, Pencil, Plus, Users, X } from "lucide-react";
import { useDetails } from "@components/ds/LogItButton";
import toast from "react-hot-toast";
import PersonPicker, { type PickedPerson } from "@components/ui/PersonPicker";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { viewingsKey } from "@/lib/db/keys";
import {
  deleteMyViewing,
  fetchMyViewings,
  fetchRoomCompanions,
  logViewing,
  type CompanionInput,
  type Viewing,
  type ViewingPlace,
} from "@/lib/db/viewings";
import { todayIso } from "@/utils/viewings";

/**
 * The dated half of the diary: when you watched it, where, and who was there.
 *
 * Sits above the composer on a title page, as a line — "Watched 10 Sep · at
 * home · with Priya" — once something is in your diary. Each entry has Edit:
 * its day, where, who was there, or Remove (ds/LogSheet, the same sheet as ⋯
 * above). A one-tap Watched writes no entry; ⋯ → "When, who & stars" does.
 *
 * Companions are the point. A viewing with a name on it is a memory; a viewing
 * without one is a row. When a Tonight room decided on this title in the last
 * few days, the people from that room are offered in the field — offered, not
 * written: a one-tap "Watched" never names anyone.
 */

function toInput(p: PickedPerson): CompanionInput {
  return p.kind === "user" ? { userId: p.userId } : { name: p.name };
}

const PLACES: { value: ViewingPlace; label: string }[] = [
  { value: "home", label: "At home" },
  { value: "cinema", label: "At the cinema" },
  { value: "other", label: "Somewhere else" },
];

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function placeLabel(place: ViewingPlace): string {
  return place === "cinema" ? "at the cinema" : place === "other" ? "somewhere else" : "at home";
}

function companionsLine(v: Viewing): string {
  const names = v.companions.map((c) => c.username ?? c.name ?? "").filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return `with ${names[0]}`;
  if (names.length === 2) return `with ${names[0]} and ${names[1]}`;
  return `with ${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

export default function LogViewing({
  withLogButton = true,
  itemId,
  itemType,
  itemName,
  imageUrl,
  genres,
  viewerId,
  onChange,
  onLogged,
}: {
  /** Off where the page already has Log it (the title action bar): this then lists your viewings only. */
  withLogButton?: boolean;
  itemId: string;
  itemType: "movie" | "tv";
  itemName?: string;
  imageUrl?: string | null;
  genres?: string[];
  viewerId: string | null;
  /** Called whenever the list changes, with what the composer needs to know. */
  onChange?: (state: { count: number; lastIsRewatch: boolean }) => void;
  /** Called after a viewing is logged, so status-driven UI can refresh. */
  onLogged?: () => void | Promise<void>;
}) {
  const key = viewerId ? viewingsKey(itemId, itemType, viewerId) : null;
  const { data: viewings, mutate, isLoading } = useSWR(key, () =>
    fetchMyViewings(viewerId as string, itemId, itemType),
  );

  useEffect(() => {
    if (!viewings) return;
    onChange?.({ count: viewings.length, lastIsRewatch: viewings[0]?.rewatch ?? false });
  }, [viewings, onChange]);

  /**
   * A "Watched" tap elsewhere on the page writes the first viewing (dated
   * today) through the status route. That is this list; refetch it when the
   * status lands on watched so the line reads "Watched today" without a
   * reload.
   */
  const { getStatus } = useContext(UserPrefrenceContext);
  const status = getStatus(itemId, itemType);
  useEffect(() => {
    if (status === "watched") void mutate();
  }, [status, mutate]);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [place, setPlace] = useState<ViewingPlace>("home");
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const roomLoaded = useRef(false);

  /**
   * The room is fetched once, when the form opens, and only pre-fills an
   * empty field — a person who has already started typing names is not
   * interrupted by a suggestion.
   */
  useEffect(() => {
    if (!open || roomLoaded.current) return;
    roomLoaded.current = true;
    fetchRoomCompanions(itemId, itemType).then((room) => {
      if (!room.length) return;
      setPeople((prev) =>
        prev.length
          ? prev
          : room
              .filter((p) => p.username)
              .map((p) => ({ kind: "user" as const, userId: p.userId, username: p.username as string, avatarUrl: p.avatarUrl })),
      );
    });
  }, [open, itemId, itemType]);

  const submit = async () => {
    if (!viewerId) return;
    setBusy(true);
    try {
      const { error } = await logViewing({
        itemId,
        itemType,
        itemName: itemName ?? "",
        imageUrl: imageUrl ?? null,
        genres: genres ?? [],
        watchedOn: date,
        place,
        companions: people.map(toInput),
      });
      if (error) {
        toast.error(error);
        return;
      }
      setOpen(false);
      setPeople([]);
      setDate(todayIso());
      setPlace("home");
      roomLoaded.current = false;
      await mutate();
      await onLogged?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = useCallback(
    async (id: number) => {
      if (!viewerId) return;
      const message = await deleteMyViewing(viewerId, id);
      if (message) {
        toast.error(message);
        return;
      }
      await mutate();
    },
    [viewerId, mutate],
  );

  const details = useDetails(
    { itemId, itemType, itemName: itemName ?? "", imageUrl: imageUrl ?? null, genres: genres ?? [] },
    {
      onChanged: () => {
        void mutate();
        void onLogged?.();
      },
    },
  );

  const latest = viewings?.[0] ?? null;
  const summary = useMemo(() => {
    if (!latest) return null;
    const parts = [`Watched ${shortDate(latest.watchedOn)}`, placeLabel(latest.place)];
    const with_ = companionsLine(latest);
    if (with_) parts.push(with_);
    return parts.join(" · ");
  }, [latest]);

  if (!viewerId) return null;

  // Without its own button this is only the list of your viewings, so with none it says nothing.
  const hidden = !withLogButton && !open && !isLoading && !(viewings && viewings.length);

  // The sheet sits first and always, in one place: it stays open (and the
  // same sheet) when removing the last entry empties the list beneath it.
  return (
    <>
      {details.sheet}
      {!hidden && (
        <div className="mb-3 rounded-2xl border border-line bg-raised/40 px-4 py-3">
          {/* ── The line ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <CalendarDays className="size-4 shrink-0 text-ink-500" />
            {isLoading ? (
              <span className="text-sm text-ink-500">…</span>
            ) : latest ? (
              <span className="text-sm text-ink-200">
                {summary}
                {viewings && viewings.length > 1 && (
                  <span className="text-ink-500"> · {viewings.length} viewings</span>
                )}
              </span>
            ) : (
              <span className="text-sm text-ink-400">Not logged yet.</span>
            )}
            {latest && !open && (
              <button
                type="button"
                onClick={() => details.open(latest)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ink-300 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
              >
                <Pencil className="size-3" aria-hidden /> Edit
              </button>
            )}
            {!open && withLogButton && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-300 transition hover:border-line-input hover:text-ink-0"
              >
                <Plus className="size-3" /> {latest ? "Add another viewing" : "Add to diary"}
              </button>
            )}
          </div>

          {/* ── Every viewing, when there is more than one ───────────────── */}
          {viewings && viewings.length > 1 && !open && (
            <ul className="mt-2 space-y-1 border-t border-line pt-2">
              {viewings.map((v) => (
                <li key={v.id} className="flex items-center gap-2 text-xs text-ink-400">
                  <span className="w-20 shrink-0 tabular-nums text-ink-300">{shortDate(v.watchedOn)}</span>
                  <span>{v.rewatch ? "rewatch" : "first time"}</span>
                  <span className="text-ink-600">·</span>
                  <span>{placeLabel(v.place)}</span>
                  {companionsLine(v) && (
                    <>
                      <span className="text-ink-600">·</span>
                      <span>{companionsLine(v)}</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => details.open(v)}
                    aria-label={`Edit the viewing on ${shortDate(v.watchedOn)}`}
                    className="ml-auto rounded-full p-1 text-ink-500 transition hover:text-ink-0"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    aria-label="Remove this viewing"
                    className="rounded-full p-1 text-ink-600 transition hover:text-danger"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ── The form ─────────────────────────────────────────────────── */}
          {open && (
            <div className="mt-3 space-y-3 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-ink-400">
                  <span>When</span>
                  <input
                    type="date"
                    value={date}
                    max={todayIso()}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg border border-line-strong bg-page px-2 py-1.5 text-sm text-ink-0 focus:border-accent-strong focus:outline-none"
                  />
                </label>
                <div role="radiogroup" aria-label="Where" className="flex flex-wrap gap-1.5">
                  {PLACES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={place === p.value}
                      onClick={() => setPlace(p.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        place === p.value
                          ? "border-accent-strong/60 bg-action/10 text-accent-soft"
                          : "border-line-strong text-ink-400 hover:border-line-input hover:text-ink-0"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-400">
                  <Users className="size-3.5" /> Who was there
                </div>
                <PersonPicker value={people} onChange={setPeople} />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="rounded-full px-3 py-1.5 text-xs text-ink-400 transition hover:text-ink-0 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Add to diary"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
