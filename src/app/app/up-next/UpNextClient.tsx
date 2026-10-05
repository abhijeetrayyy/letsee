"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Check, LoaderCircle, Search, Shuffle } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Faces from "@components/ds/Faces";
import { LogCheck, useLogIt } from "@components/ds/LogItButton";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList, type Pass, type RoomPerson } from "@/lib/db/rooms";
import { fetchSaves, restorePass, savePass, setPassAside, setPlan } from "@/lib/db/upNext";
import { laneOf, pickOne, pickReason, type Save } from "@/lib/people/lanes";
import { ago } from "@components/rooms/time";
import { todayIso } from "@/utils/viewings";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import ThanksSheet from "./ThanksSheet";
import { tonightHref } from "@/lib/people/tonight";
import YourAsks from "@components/rooms/YourAsks";
import { EpisodeRow, SaveRow, episodesFetcher, type Episode } from "@components/ds/UpNextRows";

/**
 * Up next (docs/design/PAGES.md §3): choose what to watch next.
 *
 * Tonight, the next episode of each show you're on, what people passed you,
 * what you've lined up, and someday. Anything can be marked watched from its
 * own row, with Undo.
 *
 * Tonight is where the choosing happens. With nothing lined up, the hard part
 * is ninety posters in Someday; "Pick one for me" chooses from them (favouring
 * what's leaving a service and what someone told you to watch), says why, and
 * lines it up in one tap. Someday shows its first eighteen until asked for
 * the rest, or until you search it. Everything but the next episodes is read in the browser
 * under your own RLS; the episodes come from `/api/continue-watching`, which
 * already resolves each show's next episode against TMDB.
 */
const quiet = "inline-flex h-9 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 disabled:opacity-60";
const key = (t: { itemType: string; itemId: string }) => `${t.itemType}:${t.itemId}`;
/** Six rows of three on a phone; the rest are one tap, a search or a filter away. */
const FIRST = 18;

export default function UpNextClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const region = (user?.watch_region || "US").toUpperCase();

  const { data: saves, mutate: refreshSaves } = useSWR(me ? ["saves", me, region] : null, () => fetchSaves(me!, region), { revalidateOnFocus: false });
  const { data: list } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const { data: episodes, mutate: setEpisodes } = useSWR<{ items: Episode[] }>(me ? "/api/continue-watching" : null, episodesFetcher, {
    revalidateOnFocus: false,
  });

  /** Logged from this page: shown as done until the page is next loaded. */
  const [done, setDone] = useState<Set<string>>(new Set());
  const mark = (k: string, on: boolean) =>
    setDone((cur) => {
      const next = new Set(cur);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "movie" | "tv">("all");

  if (status === "anon") {
    return (
      <Page>
        <p className="text-base text-ink-400">What you’re watching next, what people passed you, and what you’ve lined up.</p>
        <Link href="/login?next=/app/up-next" className="mt-6 inline-flex h-11 items-center rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
          Sign in
        </Link>
      </Page>
    );
  }
  if (!me || !saves) {
    return (
      <Page>
        <div className="grid gap-3" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-card bg-raised" />
          ))}
        </div>
      </Page>
    );
  }

  const today = todayIso();
  const tonight = saves.filter((s) => laneOf(s, today) === "tonight");
  const linedUp = saves
    .filter((s) => laneOf(s, today) === "lined-up")
    .sort((a, b) => (a.saveForDate ?? "9999").localeCompare(b.saveForDate ?? "9999"));
  const someday = saves.filter((s) => laneOf(s, today) === "someday");
  const passes = list?.passesToMe ?? [];
  const saved = new Set(saves.map(key));
  const decideWith = (list?.people ?? []).slice(0, 3).map((p) => p.person);
  const shows = (episodes?.items ?? []).filter((e) => !e.is_caught_up || e.waiting).slice(0, 8);
  const nothing = !saves.length && !passes.length && !shows.length;

  return (
    <Page>
      {me && (
        <Section title="Tonight">
          {tonight.length > 0 ? (
            <ul className="divide-y divide-line">
              {tonight.map((s) => (
                <SaveRow key={key(s)} save={s} done={done.has(key(s))} onDone={(on) => mark(key(s), on)} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">Nothing lined up for tonight.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {someday.length > 1 && <Picker me={me} saves={someday} today={today} onPlanned={(edit) => void refreshSaves((cur) => (cur ? edit(cur) : cur), { revalidate: false })} />}
            {decideWith.length > 0 && (
              <Link href={tonightHref(decideWith.map((p) => p.username))} className={quiet}>
                <Faces people={decideWith} size={20} />
                Decide with…
              </Link>
            )}
          </div>
          {/* Don't know what you want? Ask the people who know you (migration 110). */}
          <div className="mt-6">
            <YourAsks me={me} />
          </div>
        </Section>
      )}

      {/* Held open while the episodes load (TMDB, a few seconds cold), so
          everything under it doesn't jump down when they arrive. */}
      {!episodes && (
        <Section title="Next episodes">
          <div className="grid gap-3" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <div className="aspect-2/3 w-12 rounded-media bg-raised" />
                <div className="h-4 flex-1 rounded bg-raised" />
              </div>
            ))}
          </div>
        </Section>
      )}

      {shows.length > 0 && (
        <Section title="Next episodes">
          <ul className="divide-y divide-line">
            {shows.map((e) => (
              <EpisodeRow key={e.show_id} episode={e} onMarked={(next) => void setEpisodes(next, { revalidate: false })} all={episodes!.items} onFailed={() => void setEpisodes()} onSaved={() => void setEpisodes()} />
            ))}
          </ul>
        </Section>
      )}

      {passes.length > 0 && (
        <Section title="From people">
          <ul className="grid gap-3">
            {passes.map((p) => (
              <PassCard key={p.id} me={me} pass={p} saved={saved.has(key(p))} onSaved={() => void refreshSaves()} />
            ))}
          </ul>
        </Section>
      )}

      {linedUp.length > 0 && (
        <Section title="Lined up">
          <ul className="divide-y divide-line">
            {linedUp.map((s) => (
              <SaveRow key={key(s)} save={s} done={done.has(key(s))} onDone={(on) => mark(key(s), on)} />
            ))}
          </ul>
        </Section>
      )}

      {someday.length > 0 && (
        <Section title="Someday">
          <Someday saves={someday} query={query} setQuery={setQuery} kind={kind} setKind={setKind} done={done} mark={mark} />
        </Section>
      )}

      {nothing && (
        <div className="rounded-card border border-line-strong bg-raised px-5 py-8">
          <p className="font-display text-xl text-ink-0">Nothing up next.</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">
            Save a film from its page and it waits here. When someone passes you one, it arrives here too, with their name on it.
          </p>
          <Link href="/app/search" className={`${quiet} mt-5`}>
            Find something
          </Link>
        </div>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-app px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <h1 className="text-4xl text-ink-0 sm:text-5xl">Up next</h1>
      {/* Two columns on a desktop; Someday's grid takes the full width. */}
      <div className="mt-8 grid gap-12 lg:grid-cols-2 lg:gap-x-16">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={`min-w-0 ${title === "Someday" ? "lg:col-span-2" : ""}`}>
      <h2 className="mb-4 text-2xl text-ink-0 sm:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function PassCard({ me, pass, saved, onSaved }: { me: string; pass: Pass & { person: RoomPerson }; saved: boolean; onSaved: () => void }) {
  const [state, setState] = useState<"open" | "logged" | "aside" | "gone">("open");
  const [busy, setBusy] = useState(false);
  const [thanking, setThanking] = useState(false);
  const [isSaved, setIsSaved] = useState(saved);
  const href = titlePath(pass.itemType, pass.itemId, pass.itemName);
  // Logging closes the pass (097's trigger tells the giver once); then the card offers thanks.
  const logIt = useLogIt(
    { itemId: pass.itemId, itemType: pass.itemType, itemName: pass.itemName, imageUrl: pass.imageUrl },
    { onLogged: () => setState("logged"), onUndone: () => setState("open") },
  );
  if (state === "gone") return null;

  const aside = async () => {
    setBusy(true);
    const error = await setPassAside(me, pass.id);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setState("aside");
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Set aside. {pass.person.username} won’t be told.
          <button
            type="button"
            className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
            onClick={async () => {
              toast.dismiss(t.id);
              const undoError = await restorePass(me, pass.id);
              if (undoError) toast.error(undoError);
              else setState("open");
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  };

  const save = async () => {
    setBusy(true);
    const error = await savePass({ ...pass, fromUserId: pass.person.id });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    setIsSaved(true);
    onSaved();
    toast.success(`Saved, from ${pass.person.username}`);
  };

  if (state === "aside") return null;

  return (
    <li className="rounded-card border border-line-strong bg-raised p-4">
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <Link href={`/app/people/${encodeURIComponent(pass.person.username)}`} className="flex items-center gap-2 hover:text-ink-0">
          <Avatar src={pass.person.avatarUrl} name={pass.person.username} size={24} />
          <span className="font-medium text-ink-0">{pass.person.username}</span>
        </Link>
        <span>passed you this</span>
        <span className="ml-auto font-mono text-xs text-ink-500">{ago(pass.at)}</span>
      </div>
      <div className="mt-3 flex gap-3.5">
        <Link href={href} aria-label={`Open ${pass.itemName}`} className="shrink-0">
          <img src={getPosterUrl(pass.imageUrl, "w185")} alt="" loading="lazy" className="aspect-2/3 w-16 rounded-media bg-hover object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={href} className="font-display text-lg leading-snug text-ink-0 hover:underline">
            {pass.itemName}
          </Link>
          {pass.note && <p className="mt-1 font-display text-base italic leading-snug text-ink-300">“{pass.note}”</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state === "logged" ? (
          <>
            <button type="button" onClick={() => setThanking(true)} className="inline-flex h-9 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
              Say thanks to {pass.person.username}
            </button>
            <button type="button" onClick={() => setState("gone")} className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-400 hover:bg-hover hover:text-ink-0">
              Not now
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => void logIt.log()} disabled={logIt.busy} className={quiet}>
              {logIt.busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              Watched it
            </button>
            <span className="ml-auto flex gap-2">
              {!isSaved && (
                <button type="button" disabled={busy} onClick={save} className={quiet}>
                  Save
                </button>
              )}
              <button type="button" disabled={busy} onClick={aside} className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium text-ink-400 hover:bg-hover hover:text-ink-0 disabled:opacity-60">
                Not for me
              </button>
            </span>
          </>
        )}
      </div>
      {logIt.sheet}
      <ThanksSheet open={thanking} onClose={() => setThanking(false)} me={me} to={pass.person} itemId={pass.itemId} itemType={pass.itemType} itemName={pass.itemName} />
    </li>
  );
}

/**
 * "Pick one for me": one save from Someday, weighted toward what's leaving
 * and what someone recommended (`pickOne`), with the reason it came up. Tonight
 * lines it up for today — it moves into the list above — with Undo; Another
 * picks again without repeating the last one.
 */
function Picker({
  me,
  saves,
  today,
  onPlanned,
}: {
  me: string;
  saves: Save[];
  today: string;
  /** An edit to the cached list, applied to it as it is then — so an Undo never rewinds anything else. */
  onPlanned: (edit: (cur: Save[]) => Save[]) => void;
}) {
  const [picked, setPicked] = useState<Save | null>(null);
  const [busy, setBusy] = useState(false);
  const roll = () => setPicked((cur) => pickOne(saves, new Set(cur ? [key(cur)] : [])));
  // Focus follows the pick: onto Tonight when a card appears, back to the
  // button once it's lined up — neither control survives the change, so
  // without this focus fell to the top of the page. "Another" keeps its own.
  const pickButton = useRef<HTMLButtonElement>(null);
  const tonightButton = useRef<HTMLButtonElement>(null);
  const hadPick = useRef(false);
  useEffect(() => {
    if (picked && !hadPick.current) tonightButton.current?.focus();
    if (!picked && hadPick.current) pickButton.current?.focus();
    hadPick.current = !!picked;
  }, [picked]);

  const plan = (target: Save, saveFor: Save["saveFor"], saveForDate: string | null) => (cur: Save[]) =>
    cur.map((s) => (key(s) === key(target) ? { ...s, saveFor, saveForDate } : s));

  const lineUp = async (target: Save) => {
    const before = { saveFor: target.saveFor, saveForDate: target.saveForDate };
    setBusy(true);
    const error = await setPlan(me, target, { saveFor: "date", saveForDate: today });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    onPlanned(plan(target, "date", today));
    setPicked(null);
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          {target.itemName} is on for tonight.
          <button
            type="button"
            className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
            onClick={async () => {
              toast.dismiss(t.id);
              const undoError = await setPlan(me, target, before);
              if (undoError) toast.error(undoError);
              else onPlanned(plan(target, before.saveFor, before.saveForDate));
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  };

  const href = picked ? titlePath(picked.itemType, picked.itemId, picked.itemName) : "";
  const reason = picked ? pickReason(picked) : null;

  // The live region stays mounted, so the first pick is announced too.
  return (
    <div aria-live="polite" className={picked ? "w-full" : undefined}>
      {!picked ? (
        <button ref={pickButton} type="button" onClick={roll} className={quiet}>
          <Shuffle className="size-4" aria-hidden />
          Pick one for me
        </button>
      ) : (
        <div className="flex w-full gap-4 rounded-card border border-line-strong bg-raised p-4">
          <Link href={href} aria-label={`Open ${picked.itemName}`} className="shrink-0">
            <img src={getPosterUrl(picked.imageUrl, "w185")} alt="" className="aspect-2/3 w-20 rounded-media bg-hover object-cover" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Picked from {saves.length} saved</p>
            <Link href={href} className="mt-1 block font-display text-xl leading-snug text-ink-0 hover:underline">
              {picked.itemName}
            </Link>
            {reason && <p className="mt-1 text-sm text-ink-400">{reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                ref={tonightButton}
                type="button"
                onClick={() => void lineUp(picked)}
                disabled={busy}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover disabled:opacity-60"
              >
                {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
                Tonight
              </button>
              <button type="button" onClick={roll} disabled={busy} className={quiet}>
                <Shuffle className="size-4" aria-hidden />
                Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Someday({
  saves,
  query,
  setQuery,
  kind,
  setKind,
  done,
  mark,
}: {
  saves: Save[];
  query: string;
  setQuery: (q: string) => void;
  kind: "all" | "movie" | "tv";
  setKind: (k: "all" | "movie" | "tv") => void;
  done: Set<string>;
  mark: (k: string, on: boolean) => void;
}) {
  const q = query.trim().toLowerCase();
  const [all, setAll] = useState(false);
  const matches = useMemo(
    () => saves.filter((s) => (kind === "all" || s.itemType === kind) && (!q || s.itemName.toLowerCase().includes(q))),
    [saves, kind, q],
  );
  // A search or a filter is asked for, so it shows everything it finds.
  const shown = all || q || kind !== "all" ? matches : matches.slice(0, FIRST);
  const chip = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {saves.length > 12 && (
          <label className="relative min-w-0 flex-1 basis-48">
            <span className="sr-only">Search your list</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${saves.length} saved`}
              className="h-9 w-full rounded-full bg-raised pl-9 pr-3 text-sm text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
        )}
        <div className="flex gap-2">
          {(["all", "movie", "tv"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {k === "all" ? "All" : k === "movie" ? "Films" : "Series"}
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((s) => {
            const k = key(s);
            return (
              <li key={k} className={`relative transition-opacity ${done.has(k) ? "opacity-60" : ""}`}>
                <Link href={titlePath(s.itemType, s.itemId, s.itemName)} className="block">
                  <img src={getPosterUrl(s.imageUrl, "w185")} alt={s.itemName} loading="lazy" className="aspect-2/3 w-full rounded-media bg-hover object-cover" />
                  <span className="mt-1.5 block truncate text-xs text-ink-400">{s.itemName}</span>
                  {s.leaving && <span className="block truncate text-xs text-ink-500">Leaves {s.leaving.provider}</span>}
                </Link>
                <LogCheck
                  overlay
                  className="absolute right-1.5 top-1.5"
                  title={{ itemId: s.itemId, itemType: s.itemType, itemName: s.itemName, imageUrl: s.imageUrl, genres: s.genres }}
                  onLogged={() => mark(k, true)}
                  onUndone={() => mark(k, false)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">Nothing saved by that name.</p>
      )}
      {shown.length < matches.length && (
        <button type="button" onClick={() => setAll(true)} className={`${quiet} mt-6`}>
          Show all {matches.length}
        </button>
      )}
    </>
  );
}
