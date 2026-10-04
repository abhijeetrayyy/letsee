"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import toast from "react-hot-toast";
import Sheet from "@components/ds/Sheet";
import StarRating from "@components/ui/StarRating";
import PersonPicker, { type PickedPerson } from "@components/ui/PersonPicker";
import { setViewingCompanions, updateMyViewing, type CompanionInput } from "@/lib/db/viewings";
import { deleteMyTake, fetchMyTake, saveMyTake } from "@/lib/db/takes";
import { NA } from "@/utils/takes";
import { todayIso } from "@/utils/viewings";

/**
 * The details of a viewing that was already logged (docs/design/SYSTEM.md §8,
 * `LogSheet`; docs/design/RETHINK.md §7).
 *
 * The one-tap log has already saved the viewing for today. This sheet is
 * optional and has no submit button: every field saves the moment it changes,
 * and closing it is always safe. Who was there comes first after the date,
 * because a viewing with a name on it is a memory and one without is a row.
 *
 * Seen by *Just me*, *Us* or *Shelf*. *Us* — the people who were there —
 * is offered once someone on letsee is named under "Who was there", and is
 * the private row with `visibility = 'us'` (migration 112): they read it on
 * the title's page and in your room, nobody else does.
 */
type When = "tonight" | "last-night" | "pick";
type Audience = "me" | "us" | "shelf";

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toCompanions(people: PickedPerson[]): CompanionInput[] {
  return people.map((p) => (p.kind === "user" ? { userId: p.userId } : { name: p.name }));
}

export type LoggedViewing = { id: number; watchedOn: string };

export default function LogSheet({
  open,
  onClose,
  userId,
  viewing,
  itemId,
  itemType,
  itemName,
  imageUrl,
  genres,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  viewing: LoggedViewing | null;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl?: string | null;
  genres?: string[];
}) {
  const [when, setWhen] = useState<When>("tonight");
  const [date, setDate] = useState(todayIso());
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [words, setWords] = useState("");
  const [audience, setAudience] = useState<Audience>("me");
  /**
   * Your existing take, read before anything can be saved. A rating is one
   * judgement per title and the words live beside it, so the sheet edits the
   * take you already have — a rewatch, or a title rated before it was logged —
   * rather than starting from nothing and overwriting it with nothing.
   */
  const [take, setTake] = useState<"loading" | "ready" | "failed">("loading");
  /** Both a private note and a public review (the 065 split): audience is left alone here. */
  const [split, setSplit] = useState(false);
  const savedWords = useRef("");
  const savedPublic = useRef<boolean | null>(null);
  /** One save at a time: a blur and a chip tap must not race each other into two rows. */
  const queue = useRef<Promise<void>>(Promise.resolve());

  const identity = { itemId, itemType, scope: "title" as const, seasonNumber: NA, episodeNumber: NA };

  // A new viewing starts a fresh sheet, filled with the take you already have.
  useEffect(() => {
    if (!viewing) return;
    let stale = false;
    const today = todayIso();
    setDate(viewing.watchedOn);
    setWhen(viewing.watchedOn === today ? "tonight" : viewing.watchedOn === yesterdayIso() ? "last-night" : "pick");
    setPeople([]);
    setScore(null);
    setWords("");
    setAudience("me");
    setSplit(false);
    setTake("loading");
    savedWords.current = "";
    savedPublic.current = null;
    fetchMyTake(userId, { itemId, itemType, scope: "title", seasonNumber: NA, episodeNumber: NA })
      .then(({ take: mine, privateNote }) => {
        if (stale) return;
        if (mine) {
          setScore(mine.score);
          setWords(mine.body);
          savedWords.current = mine.body;
          setAudience(mine.isPublic ? "shelf" : mine.forUs ? "us" : "me");
          savedPublic.current = mine.isPublic;
        }
        setSplit(!!privateNote);
        setTake("ready");
      })
      .catch(() => {
        if (!stale) setTake("failed");
      });
    return () => {
      stale = true;
    };
  }, [viewing, userId, itemId, itemType]);
  /** Someone on letsee was there, so there is an "us" to write to. */
  const withSomeone = people.some((p) => p.kind === "user");

  const fail = (message: string | null) => {
    if (message) toast.error(message);
  };

  const saveDate = async (nextWhen: When, nextDate: string) => {
    setWhen(nextWhen);
    setDate(nextDate);
    if (viewing) fail(await updateMyViewing(userId, viewing.id, { watchedOn: nextDate }));
  };

  const savePeople = async (next: PickedPerson[]) => {
    setPeople(next);
    if (viewing) fail(await setViewingCompanions(viewing.id, toCompanions(next)));
  };

  /**
   * Score and words live on one take; visibility decides which row it is.
   * The values are fixed when the save is asked for and the saves run in
   * order, so whichever happens second — the blur or the chip — sees the row
   * the first one left behind.
   */
  const saveTake = useCallback(
    (next: { score?: number | null; body?: string; audience?: Audience }) => {
      if (take !== "ready") return;
      const to = next.audience ?? audience;
      const pub = to === "shelf";
      const values = {
        score: next.score !== undefined ? next.score : score,
        body: (next.body ?? words).trim() || null,
        watchedAt: date ? new Date(`${date}T20:00:00`).toISOString() : null,
      };
      queue.current = queue.current.then(async () => {
        // Moving between private and Shelf moves the take to the other row.
        if (savedPublic.current !== null && savedPublic.current !== pub) {
          fail(await deleteMyTake(userId, identity, savedPublic.current));
        }
        const error = await saveMyTake(userId, identity, {
          ...values,
          isPublic: pub,
          forUs: to === "us",
          itemName,
          imageUrl: imageUrl ?? null,
          genres: genres ?? [],
        });
        fail(error);
        if (!error) savedPublic.current = pub;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [take, userId, itemId, itemType, audience, score, words, date, itemName, imageUrl, genres],
  );

  const chip = (on: boolean) =>
    `inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${
      on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;

  return (
    <Sheet open={open} onClose={onClose} title="Logged" description={`${itemName} · saved already. Anything you add here saves as you go.`}>
      <div className="grid gap-5">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-xs font-medium text-ink-500">When</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(when === "tonight")} aria-pressed={when === "tonight"} onClick={() => saveDate("tonight", todayIso())}>
              Today
            </button>
            <button type="button" className={chip(when === "last-night")} aria-pressed={when === "last-night"} onClick={() => saveDate("last-night", yesterdayIso())}>
              Last night
            </button>
            <label className={chip(when === "pick")}>
              <Calendar className="size-4" aria-hidden />
              <span>{when === "pick" ? date : "Pick a day"}</span>
              <input
                type="date"
                className="sr-only"
                max={todayIso()}
                value={date}
                onChange={(e) => e.target.value && saveDate("pick", e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-ink-500">Who was there</p>
          <PersonPicker value={people} onChange={savePeople} placeholder="A friend on letsee, or just a name" />
          {withSomeone && (
            <p className="text-xs text-ink-500">They’ll be asked whether they were there too. Nothing is added to their diary unless they say yes.</p>
          )}
        </div>

        {take !== "ready" && (
          <p className="text-xs text-ink-500" role="status">
            {take === "loading" ? "Getting your rating and words…" : "Your rating and words didn't load, so they can't be changed here. Close this and try again."}
          </p>
        )}
        <fieldset disabled={take !== "ready"} className="grid gap-5 disabled:opacity-60">
        <div className="grid gap-2">
          <p className="text-xs font-medium text-ink-500">Your rating</p>
          <StarRating
            value={score}
            size="lg"
            allowClear
            label="Your rating"
            onChange={(next) => {
              setScore(next);
              void saveTake({ score: next });
            }}
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="log-words" className="text-xs font-medium text-ink-500">
            Your words
          </label>
          <textarea
            id="log-words"
            rows={3}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            onBlur={() => {
              if (words.trim() === savedWords.current.trim()) return;
              savedWords.current = words;
              void saveTake({ body: words });
            }}
            placeholder="What stayed with you?"
            className="w-full resize-none rounded-control bg-raised px-3.5 py-3 font-display text-base italic text-ink-0 ring-1 ring-inset ring-line-input placeholder:not-italic placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>

        {/* Who sees it only means something once there's a rating or words:
            until then it's one more choice standing between you and Close. */}
        {(score !== null || words.trim() || audience !== "me") && (
        <fieldset className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <legend className="sr-only">Who can see your rating and words</legend>
            <span className="text-sm text-ink-500">Seen by</span>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["me", "Just me"],
                  ...(withSomeone || audience === "us" ? ([["us", "Us"]] as const) : []),
                  ["shelf", "Shelf"],
                ] as [Audience, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={chip(audience === value)}
                  aria-pressed={audience === value}
                  disabled={split}
                  onClick={() => {
                    setAudience(value);
                    if (score !== null || words.trim()) void saveTake({ audience: value });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-500" aria-live="polite">
            {split
              ? "You keep a private note and a public review on this one. Change who sees which on the film's page."
              : audience === "us"
              ? "Only people you've named as watching it with you can read it, on the film's page and in your room."
              : audience === "shelf"
                ? "Anyone who can see your profile, and on the film's page."
                : withSomeone
                  ? "Only you. Choose Us to share it with the people who were there."
                  : "Only you."}
          </p>
        </fieldset>
        )}
        </fieldset>

        <button type="button" onClick={onClose} className="btn-secondary h-11 w-full">
          Close
        </button>
      </div>
    </Sheet>
  );
}
