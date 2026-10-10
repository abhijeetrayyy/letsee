"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { LoaderCircle } from "lucide-react";
import toast from "react-hot-toast";
import Sheet from "@components/ds/Sheet";
import DayChip from "@components/ds/DayChip";
import StarRating from "@components/ui/StarRating";
import PersonPicker, { type PickedPerson } from "@components/ui/PersonPicker";
import { deleteMyViewing, logViewing, setViewingCompanions, updateMyViewing, type CompanionInput, type ViewingPlace } from "@/lib/db/viewings";
import { deleteMyTake, fetchMyTake, saveMyTake } from "@/lib/db/takes";
import { NA } from "@/utils/takes";
import { todayIso, type Companion } from "@/utils/viewings";

/**
 * Details: when you watched it, where, who was there, your stars and words —
 * every one optional, none of it standing between a tap and a title being
 * marked (docs/design/SYSTEM.md §8, `LogSheet`).
 *
 * The owner (10 Oct 2026): logging must be one tap — Watched registers
 * watched, Watching registers watching — with the rest changeable any time
 * from ⋯, never asked for on the way. So this sheet is never on the path: it
 * opens from ⋯ on a title, from a poster's marks, and from each entry in your
 * diary, and it writes nothing you didn't choose.
 *
 * - With an entry (`viewing`): edits that entry — its day, where, who was
 *   there — and *Remove from diary* takes it out (the mark stays).
 * - Without one: nothing is written until you say when. Picking a day — or
 *   naming who was there, which needs a day and takes today — puts it in your
 *   diary, which also marks it watched. Stars and words never need a day.
 *
 * It used to be opened only after "Add to diary" had already written a
 * viewing dated today, so adding stars to a film you saw years ago put it in
 * the diary as watched today; and editing an older entry started with nobody
 * in "Who was there", so naming one person dropped the rest.
 *
 * No submit button: every field saves the moment it changes, one save at a
 * time, and closing is always safe. *Us* — the people who were there — is
 * offered once someone on letsee is named, as before (migration 112).
 */
type Audience = "me" | "us" | "shelf";

export type LoggedViewing = { id: number; watchedOn: string; place?: ViewingPlace; companions?: Companion[] };

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toCompanions(people: PickedPerson[]): CompanionInput[] {
  return people.map((p) => (p.kind === "user" ? { userId: p.userId } : { name: p.name }));
}

function toPicked(c: Companion): PickedPerson | null {
  if (c.userId) return { kind: "user", userId: c.userId, username: c.username ?? "someone", avatarUrl: c.avatarUrl };
  return c.name ? { kind: "name", name: c.name } : null;
}

const PLACES: [ViewingPlace, string][] = [
  ["home", "At home"],
  ["cinema", "Cinema"],
  ["other", "Elsewhere"],
];

export default function LogSheet({
  open,
  onClose,
  userId,
  viewing,
  again = false,
  itemId,
  itemType,
  itemName,
  imageUrl,
  genres,
  adult,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  /** The diary entry to edit; `null` for none yet (or another viewing, with `again`). */
  viewing: LoggedViewing | null;
  /** Another viewing of something already in the diary: a rewatch. */
  again?: boolean;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl?: string | null;
  genres?: string[];
  adult?: boolean;
  /** An entry was added, changed or removed: lists showing the diary refetch. */
  onChanged?: (entry: LoggedViewing | null) => void;
}) {
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const [entry, setEntry] = useState<LoggedViewing | null>(viewing);
  const [day, setDay] = useState(todayIso());
  const [place, setPlace] = useState<ViewingPlace>("home");
  const [people, setPeople] = useState<PickedPerson[]>([]);
  const [adding, setAdding] = useState(false);
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
  /** The entry as the queue sees it: a save queued before the entry existed uses the one made just ahead of it. */
  const entryRef = useRef<LoggedViewing | null>(viewing);
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  const identity = { itemId, itemType, scope: "title" as const, seasonNumber: NA, episodeNumber: NA };

  // Each opening starts from what's saved: the entry you opened, and your take.
  // Keyed on the entry's id, not the object: a caller that rebuilds it while
  // the sheet is open must not wipe what's being typed.
  const viewingId = viewing?.id ?? null;
  useEffect(() => {
    if (!open) return;
    let stale = false;
    entryRef.current = viewing;
    setEntry(viewing);
    setDay(viewing?.watchedOn ?? todayIso());
    setPlace(viewing?.place ?? "home");
    setPeople((viewing?.companions ?? []).map(toPicked).filter((p): p is PickedPerson => !!p));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, viewingId, userId, itemId, itemType]);

  /** Someone on letsee was there, so there is an "us" to write to. */
  const withSomeone = people.some((p) => p.kind === "user");

  const fail = (message: string | null) => {
    if (message) toast.error(message);
  };

  const enqueue = (job: () => Promise<void>) => {
    queue.current = queue.current.then(job, job);
  };

  const settle = (next: LoggedViewing | null) => {
    entryRef.current = next;
    setEntry(next);
    onChangedRef.current?.(next);
  };

  /** Into the diary: the first thing that needs a day writes the entry. */
  const addEntry = async (watchedOn: string, who: PickedPerson[]) => {
    setAdding(true);
    const { viewing: made, error } = await logViewing({
      itemId,
      itemType,
      itemName,
      imageUrl: imageUrl ?? null,
      genres: genres ?? [],
      adult,
      watchedOn,
      companions: toCompanions(who),
    });
    setAdding(false);
    if (error || !made) {
      toast.error(error ?? "Couldn't add that to your diary. Check your connection and try again.");
      return;
    }
    settle({ id: made.id, watchedOn: made.watchedOn, place: made.place, companions: made.companions });
    // A diary entry marks it watched: the marks everywhere follow.
    void refreshPreferences();
  };

  const saveDay = (next: string) => {
    setDay(next);
    enqueue(async () => {
      const current = entryRef.current;
      if (!current) return addEntry(next, people);
      const error = await updateMyViewing(userId, current.id, { watchedOn: next });
      fail(error);
      if (!error) settle({ ...current, watchedOn: next });
    });
  };

  const savePlace = (next: ViewingPlace) => {
    setPlace(next);
    enqueue(async () => {
      const current = entryRef.current;
      if (!current) return;
      const error = await updateMyViewing(userId, current.id, { place: next });
      fail(error);
      if (!error) settle({ ...current, place: next });
    });
  };

  const savePeople = (next: PickedPerson[]) => {
    setPeople(next);
    enqueue(async () => {
      const current = entryRef.current;
      // Naming who was there needs a day: today, until you pick another.
      if (!current) return next.length ? addEntry(day, next) : undefined;
      fail(await setViewingCompanions(current.id, toCompanions(next)));
      onChangedRef.current?.(current);
    });
  };

  const removeEntry = () => {
    enqueue(async () => {
      const current = entryRef.current;
      if (!current) return;
      const error = await deleteMyViewing(userId, current.id);
      if (error) return fail(error);
      settle(null);
      setPeople([]);
      setDay(todayIso());
      toast.success("Taken out of your diary. It's still marked watched.");
    });
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
        watchedAt: entry ? new Date(`${entry.watchedOn}T20:00:00`).toISOString() : null,
      };
      enqueue(async () => {
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
    [take, userId, itemId, itemType, audience, score, words, entry, itemName, imageUrl, genres],
  );

  const chip = (on: boolean) =>
    `inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
      on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;
  const today = todayIso();
  const yesterday = yesterdayIso();
  // A day is "chosen" only once it's in the diary: until then nothing is lit.
  const chosen = entry ? entry.watchedOn : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? "Your diary entry" : again ? "Watched it again" : "Details"}
      description={`${itemName} · everything here is optional and saves as you go.`}
    >
      <div className="grid gap-6">
        <fieldset className="grid gap-2" disabled={adding}>
          <legend className="mb-2 text-xs font-medium text-ink-500">When you watched it</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={chip(chosen === today)} aria-pressed={chosen === today} onClick={() => saveDay(today)}>
              Today
            </button>
            <button type="button" className={chip(chosen === yesterday)} aria-pressed={chosen === yesterday} onClick={() => saveDay(yesterday)}>
              Yesterday
            </button>
            <DayChip
              value={day}
              max={today}
              on={!!chosen && chosen !== today && chosen !== yesterday}
              className={chip(!!chosen && chosen !== today && chosen !== yesterday)}
              onPick={saveDay}
              disabled={adding}
            />
          </div>
          <p className="text-xs text-ink-500" aria-live="polite">
            {adding ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="size-3 animate-spin" aria-hidden /> Adding to your diary…
              </span>
            ) : entry ? (
              "In your diary."
            ) : again ? (
              "Pick the day to add this viewing to your diary."
            ) : (
              "Not in your diary yet. Pick the day to add it — or skip this; stars and words don't need one."
            )}
          </p>
          {entry && (
            <div className="mt-1 flex flex-wrap items-center gap-2" role="group" aria-label="Where">
              {PLACES.map(([value, label]) => (
                <button key={value} type="button" className={chip(place === value)} aria-pressed={place === value} onClick={() => savePlace(value)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <div className="grid gap-2">
          <p className="text-xs font-medium text-ink-500">Who was there</p>
          <PersonPicker value={people} onChange={savePeople} placeholder="A friend on letsee, or just a name" />
          {!entry && !adding && <p className="text-xs text-ink-500">Naming someone adds it to your diary for today. Change the day above.</p>}
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
              until then it's one more choice standing between you and Done. */}
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
                  ? "You keep a private note and a public review on this one. Change who sees which on its page."
                  : audience === "us"
                    ? "Only people you've named as watching it with you can read it, on its page and in your room."
                    : audience === "shelf"
                      ? "Anyone who can see your profile, and on its page."
                      : withSomeone
                        ? "Only you. Choose Us to share it with the people who were there."
                        : "Only you."}
              </p>
            </fieldset>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {entry ? (
            <button type="button" onClick={removeEntry} className="h-10 rounded-full px-3 text-sm font-medium text-danger transition-colors hover:bg-hover">
              Remove from diary
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center rounded-full bg-ink-0 px-6 text-sm font-semibold text-page transition-colors hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}
