"use client";

import useSWR from "swr";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Heart, Loader2, Search, Send, Users } from "lucide-react";
import toast from "react-hot-toast";
import { findPerson } from "@/lib/db/rooms";
import { forgetInviter, readInviter } from "@/lib/people/invite";
import { FollowerBtnClient } from "@components/profile/profileBtn";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { getPosterUrl } from "@/utils/imageUrl";
import Avatar from "@components/ui/Avatar";
import FollowButton from "@components/profile/FollowButton";
import { fetchMyNeighbours } from "@/lib/db/taste";
import { useSearchIndex } from "@components/header/useSearchIndex";
import { inviteSomeone } from "@components/home/v2/parts";
import { fetchRecipients, type Recipients } from "@/lib/db/recipients";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { safeNext } from "@/lib/auth/next";
import { USERNAME_MAX, cleanUsername, usernameProblem, usernameSaveProblem } from "@/lib/people/username";

/**
 * The first few minutes: a name, a look at what's here, a few films you love,
 * and anyone you know. Only the name is needed — it's your profile's address —
 * and every step after it says plainly that it can be skipped, with a Skip as
 * big as the button beside it and "Skip setup" at the top of the page.
 *
 * It used to be four steps of things to do: import a history, pick exactly
 * four films, follow at least one person. Someone who knows nobody here, and
 * has nothing to import, met two screens asking for what they didn't have. Now
 * the second step shows what letsee does instead of asking for anything, and
 * importing lives where it always has (Settings, and Home's first card).
 */
const STEPS = ["name", "tour", "picks", "people"] as const;
type Step = (typeof STEPS)[number];
const STEP_STORE = "letsee:welcome-step";
const PICKS_MAX = 4;

function rememberStep(step: Step) {
  try {
    window.sessionStorage.setItem(STEP_STORE, step);
  } catch {
    // Not remembered; a reload starts after the name.
  }
}

function savedStep(): Step | null {
  try {
    const s = window.sessionStorage.getItem(STEP_STORE);
    return STEPS.includes(s as Step) && s !== "name" ? (s as Step) : null;
  } catch {
    return null;
  }
}

export default function WelcomePage() {
  const router = useRouter();
  const { user, status, refresh } = useAuth();
  const [step, setStep] = useState<Step>("name");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (status === "anon") router.replace("/login?next=/app/welcome");
    // Someone with a name is past the first step: back where they were, or the next one.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the session resolves after mount
    if (status === "ok" && user?.username) setStep((s) => (s === "name" ? savedStep() ?? "tour" : s));
  }, [status, user?.username, router]);

  const go = useCallback((next: Step) => {
    setStep(next);
    rememberStep(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  /**
   * Into the app. Checks the name really saved first: without one every page
   * sends you back here, which would look like a button that does nothing.
   * A full page load rather than router.push, so the middleware and the
   * providers see the new profile on the way in.
   */
  const finish = useCallback(async () => {
    setLeaving(true);
    const { data: auth } = await supabase.auth.getUser();
    let name = user?.username ?? "";
    if (auth?.user) {
      const { data: profile } = await supabase.from("users").select("username").eq("id", auth.user.id).maybeSingle();
      if (!profile?.username) {
        toast.error("Choose a username first — it's your profile's address.");
        setLeaving(false);
        go("name");
        return;
      }
      name = profile.username;
    }
    try {
      window.sessionStorage.removeItem(STEP_STORE);
    } catch {
      // Nothing to forget.
    }
    // Sent here with somewhere to go next (an invitation, a shared link): there.
    const next = safeNext(new URLSearchParams(window.location.search).get("next"), "");
    if (next) {
      forgetInviter();
      window.location.assign(next);
      return;
    }
    // Invited by someone: straight into your room with them.
    const inviter = readInviter();
    if (inviter && inviter.toLowerCase() !== name.toLowerCase()) {
      forgetInviter();
      window.location.assign(`/app/people/${encodeURIComponent(inviter)}`);
      return;
    }
    window.location.assign("/app");
  }, [user?.username, go]);

  const index = STEPS.indexOf(step);

  return (
    <div className="min-h-screen w-full bg-page text-ink-0">
      <div className="mx-auto max-w-read px-4 pb-16 pt-6 sm:pt-10">
        <Progress
          index={index}
          onBack={index >= 2 ? () => go(STEPS[index - 1]) : undefined}
          onSkip={index >= 1 ? finish : undefined}
          leaving={leaving}
        />

        {step === "name" && (
          <StepName
            onDone={async () => {
              await refresh();
              go("tour");
            }}
          />
        )}
        {step === "tour" && <StepTour onNext={() => go("picks")} onSkip={finish} leaving={leaving} />}
        {step === "picks" && <StepPicks userId={user?.id ?? null} onDone={() => go("people")} />}
        {step === "people" && <StepPeople username={user?.username ?? null} onFinish={finish} leaving={leaving} />}
      </div>
    </div>
  );
}

/* ── Frame ─────────────────────────────────────────────────────────────── */

function Progress({ index, onBack, onSkip, leaving }: { index: number; onBack?: () => void; onSkip?: () => void; leaving: boolean }) {
  return (
    <div className="mb-8 flex items-center gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-hover hover:text-ink-0">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-500">
          Step {index + 1} of {STEPS.length}
        </p>
        <div className="mt-1.5 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= index ? "bg-action" : "bg-active"}`} />
          ))}
        </div>
      </div>
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          disabled={leaving}
          className="shrink-0 rounded-full px-3 py-2 text-sm font-medium text-ink-300 underline decoration-line-input underline-offset-4 transition-colors hover:text-ink-0 disabled:opacity-50"
        >
          Skip setup
        </button>
      )}
    </div>
  );
}

function Heading({ title, lead }: { title: string; lead: React.ReactNode }) {
  return (
    <>
      <h1 className="text-3xl leading-tight text-ink-0 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-base leading-relaxed text-ink-400">{lead}</p>
    </>
  );
}

/** The step's way on, and a way past it the same size beside it. */
function Actions({
  primary,
  onPrimary,
  disabled = false,
  busy = false,
  secondary,
  onSecondary,
}: {
  primary: string;
  onPrimary: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
      <button
        type="button"
        onClick={onPrimary}
        disabled={disabled || busy}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-action px-7 font-semibold text-on-action transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-44"
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {primary}
      </button>
      {secondary && onSecondary && (
        <button
          type="button"
          onClick={onSecondary}
          disabled={busy}
          className="inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover disabled:opacity-50 sm:min-w-32"
        >
          {secondary}
        </button>
      )}
    </div>
  );
}

/* ── 1. A username (the one thing needed) ──────────────────────────────── */

function StepName({ onDone }: { onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [availability, setAvailability] = useState<"unknown" | "checking" | "free" | "taken">("unknown");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const name = cleanUsername(typed);
  const problem = usernameProblem(name);

  // Checked as you type. A check that fails says nothing rather than "free":
  // the save itself is the real check, and says if someone has it.
  useEffect(() => {
    if (problem) return;
    let stale = false;
    const t = setTimeout(async () => {
      setAvailability("checking");
      const { data, error } = await supabase.from("users").select("id").eq("username", name).maybeSingle();
      if (!stale) setAvailability(error ? "unknown" : data ? "taken" : "free");
    }, 400);
    return () => {
      stale = true;
      clearTimeout(t);
      setAvailability("unknown");
    };
  }, [name, problem]);

  const save = async () => {
    if (problem || availability === "taken" || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setError("You've been signed out. Sign in again to carry on.");
        return;
      }
      /**
       * Through save_my_profile: it creates your profile row (nothing does at
       * sign-up) and returns it, and a name only counts once it's come back —
       * advancing on a write that changed nothing was the old trap where every
       * page sent you back here.
       */
      const { data: rows, error: err } = await supabase.rpc("save_my_profile", { p_username: name });
      const saved = Array.isArray(rows) ? rows[0] : rows;
      if (err) {
        setError(usernameSaveProblem(err));
        if (err.code === "23505") setAvailability("taken");
        return;
      }
      if (saved?.username !== name) {
        setError("That didn't save. Try again.");
        return;
      }
      onDone();
    } catch {
      setError("Couldn't reach letsee. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const hint = typed && problem
    ? { tone: "text-danger", text: problem }
    : availability === "checking"
      ? { tone: "text-ink-500", text: "Checking…" }
      : availability === "free"
        ? { tone: "text-accent", text: `@${name} is yours if you want it.` }
        : availability === "taken"
          ? { tone: "text-danger", text: `@${name} is taken. Try another.` }
          : { tone: "text-ink-500", text: "Lowercase letters, numbers and _ — 2 to 15 of them." };

  return (
    <section>
      <Heading title="Choose a username" lead="It's how people find you, and your profile's address. You can change it later in Settings." />
      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="welcome-username" className="mb-2 block text-sm font-medium text-ink-300">
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" aria-hidden>
            @
          </span>
          <input
            id="welcome-username"
            autoFocus
            value={name}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="moviefan"
            maxLength={USERNAME_MAX}
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            aria-describedby="welcome-username-hint"
            className="w-full rounded-xl bg-overlay/60 py-3 pl-9 pr-4 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
        <p id="welcome-username-hint" aria-live="polite" className={`mt-2 min-h-5 text-sm ${error ? "text-danger" : hint.tone}`}>
          {error || hint.text}
        </p>
        <Actions primary="Continue" onPrimary={() => void save()} disabled={!!problem || availability === "taken"} busy={saving} />
      </form>
    </section>
  );
}

/* ── 2. What's here (nothing to do) ────────────────────────────────────── */

const FEATURES = [
  {
    icon: Check,
    title: "Mark what you watch",
    body: "Watched, Watch later, Favourite — one tap each, on any poster. When you want, add a date, stars and who you watched it with to your diary.",
  },
  {
    icon: Heart,
    title: "See what people love",
    body: "Every profile shows their favourites, the four that define them, and what they've been watching lately.",
  },
  {
    icon: Users,
    title: "Find your people",
    body: "Follow anyone by their username. Each person you follow or message gets a room — one place for everything between you.",
  },
  {
    icon: Send,
    title: "Decide together",
    body: "Pass a film to a friend, see when they watch it, and pick tonight's film with whoever's on the sofa.",
  },
] as const;

function StepTour({ onNext, onSkip, leaving }: { onNext: () => void; onSkip: () => void; leaving: boolean }) {
  return (
    <section>
      <Heading title="Here's what letsee does" lead="A diary for films and series, shared with the people you watch with. Nothing to set up here — just a look around." />
      <ul className="mt-7 grid gap-3 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 rounded-card bg-raised p-4 ring-1 ring-inset ring-line-strong sm:flex-col sm:gap-0 sm:p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action/15 text-accent">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl text-ink-0 sm:mt-4">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-400">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <Actions primary="Next" onPrimary={onNext} secondary="Skip setup" onSecondary={onSkip} busy={leaving} />
    </section>
  );
}

/* ── 3. A few films you love (optional) ────────────────────────────────── */

type Pick = { itemId: string; itemType: "movie" | "tv"; name: string; posterPath: string | null };
type TmdbResult = { id: number; media_type?: string; title?: string; name?: string; poster_path?: string | null };

function StepPicks({ userId, onDone }: { userId: string | null; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [saving, setSaving] = useState(false);

  // Something to tap before anything's typed: your own titles first (if you
  // have any), then what's popular — both from the search index, no request.
  const index = useSearchIndex(true);
  const { getStatus } = useContext(UserPrefrenceContext);
  const suggestions = useMemo(() => {
    const rows = (index?.rows ?? []).filter((r) => (r.t === "movie" || r.t === "tv") && r.p);
    const seen = rows.filter((r) => r.lib && getStatus(r.k.split(":")[1], r.t) === "watched");
    return [...seen, ...rows.filter((r) => !r.lib)].slice(0, 12);
  }, [index, getStatus]);
  const fromLibrary = suggestions.some((r) => r.lib);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
       
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(q)}&media_type=multi`, { signal: controller.signal });
        const data = await res.json();
        setResults((data?.results ?? []).filter((r: TmdbResult) => r.media_type !== "person" && (r.title || r.name)).slice(0, 8));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const toggle = (r: TmdbResult) => {
    const itemId = String(r.id);
    if (picks.some((p) => p.itemId === itemId)) {
      setPicks((prev) => prev.filter((p) => p.itemId !== itemId));
      return;
    }
    if (picks.length >= PICKS_MAX) return;
    setPicks((prev) => [...prev, { itemId, itemType: r.media_type === "tv" ? "tv" : "movie", name: r.title || r.name || "", posterPath: r.poster_path ?? null }]);
    setQuery("");
    setResults([]);
  };

  /**
   * Your four on the profile, and favourites. The four already there stay
   * (a return visit adds to it rather than replacing it). Favourites are
   * added, never toggled off, and seen without a date: a film you loved isn't
   * one you watched today (api/favoriteButton, `add` and `dated`).
   */
  const save = async () => {
    if (!picks.length || saving) return;
    setSaving(true);
    let failed = false;
    try {
      const current: { item_id: string; item_type: string; item_name: string; image_url: string | null }[] = userId
        ? await fetch(`/api/profile/favorite-display?userId=${encodeURIComponent(userId)}`)
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .then((b) => b?.items ?? [])
            .catch(() => [])
        : [];
      const fresh = picks
        .filter((p) => !current.some((c) => c.item_id === p.itemId && c.item_type === p.itemType))
        .map((p) => ({ item_id: p.itemId, item_type: p.itemType, item_name: p.name, image_url: p.posterPath ? getPosterUrl(p.posterPath, "w342") : null }));
      const four = [...current, ...fresh].slice(0, PICKS_MAX).map((it) => ({ ...it, image_url: it.image_url ?? undefined }));
      const results = await Promise.all([
        fetch("/api/profile/favorite-display", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: four }) }),
        ...picks.map((p) =>
          fetch("/api/favoriteButton", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: p.itemId,
              name: p.name,
              mediaType: p.itemType,
              imgUrl: p.posterPath ? getPosterUrl(p.posterPath, "w342") : null,
              add: true,
              dated: false,
            }),
          }),
        ),
      ]);
      failed = results.some((r) => !r.ok);
    } catch {
      failed = true;
    } finally {
      setSaving(false);
    }
    if (failed) toast.error("Some of those didn't save. You can add favourites from any film's page.");
    onDone();
  };

  return (
    <section>
      <Heading title="Pick a few films you love" lead="They go on your profile, so people see your taste at a glance. Up to four — or skip this for now." />

      <div className="mt-7 grid grid-cols-4 gap-3" aria-label={`${picks.length} of ${PICKS_MAX} picked`}>
        {Array.from({ length: PICKS_MAX }).map((_, i) => {
          const p = picks[i];
          return p ? (
            <button
              key={p.itemId}
              type="button"
              onClick={() => setPicks((prev) => prev.filter((x) => x.itemId !== p.itemId))}
              aria-label={`Remove ${p.name}`}
              className="group relative aspect-2/3 overflow-hidden rounded-media ring-1 ring-inset ring-line-strong"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getPosterUrl(p.posterPath, "w185")} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-page/85 py-1 text-center text-xs font-medium text-ink-0">Remove</span>
            </button>
          ) : (
            <div key={`empty-${i}`} className="aspect-2/3 rounded-media border border-dashed border-line-input bg-raised/40" />
          );
        })}
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any film or series"
          aria-label="Search any film or series"
          className="w-full rounded-xl bg-overlay/60 py-3 pl-10 pr-10 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-500" aria-hidden />}
      </div>

      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl bg-raised ring-1 ring-inset ring-line-strong">
          {results.map((r) => (
            <li key={`${r.media_type}-${r.id}`}>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={picks.length >= PICKS_MAX}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hover disabled:opacity-40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img loading="lazy" decoding="async" src={getPosterUrl(r.poster_path ?? null, "w92")} alt="" className="aspect-2/3 w-8 rounded object-cover" />
                <span className="truncate text-sm text-ink-200">{r.title || r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!query.trim() && !index && (
        <div className="mt-6" aria-hidden>
          <p className="mb-3 text-sm text-ink-500">Finding films to suggest…</p>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="aspect-2/3 animate-pulse rounded-media bg-active motion-reduce:animate-none" />
            ))}
          </ul>
        </div>
      )}

      {!query.trim() && suggestions.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-ink-400">{fromLibrary ? "From what you've logged — tap to pick" : "Popular right now — tap to pick"}</p>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {suggestions.map((r) => {
              const id = r.k.split(":")[1];
              const on = picks.some((p) => p.itemId === id);
              return (
                <li key={r.k}>
                  <button
                    type="button"
                    onClick={() => toggle({ id: Number(id), media_type: r.t, title: r.n, poster_path: r.p ?? null })}
                    disabled={!on && picks.length >= PICKS_MAX}
                    aria-pressed={on}
                    aria-label={r.n}
                    className="relative block w-full overflow-hidden rounded-media ring-1 ring-inset ring-line-strong transition-opacity disabled:opacity-40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getPosterUrl(r.p ?? null, "w185")} alt="" loading="lazy" decoding="async" className="aspect-2/3 w-full bg-hover object-cover" />
                    {on && (
                      <span className="absolute inset-0 flex items-center justify-center bg-page/50">
                        <span className="flex size-8 items-center justify-center rounded-full bg-action text-on-action">
                          <Check className="size-4" aria-hidden />
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Actions
        primary={picks.length ? `Save ${picks.length === 1 ? "this film" : `${picks.length} films`}` : "Pick at least one"}
        onPrimary={() => void save()}
        disabled={!picks.length}
        busy={saving}
        secondary="Skip"
        onSecondary={onDone}
      />
    </section>
  );
}

/* ── 4. Anyone you know (optional) ─────────────────────────────────────── */

type Match = { userId: string; username: string; avatarUrl: string | null; icebreaker: string };

/** The person whose invitation brought you here, first, with Follow. */
function InvitedBy() {
  const { user } = useAuth();
  const [name] = useState(() => readInviter());
  // A private profile takes a follow request rather than a follow, so the button needs to know.
  const { data: person } = useSWR(name ? ["invite-person-visibility", name.toLowerCase()] : null, async () => {
    const found = await findPerson(name!);
    if (!found) return null;
    const { data } = await supabase.from("users").select("visibility").eq("id", found.id).maybeSingle();
    return { ...found, visibility: String(data?.visibility ?? "public").toLowerCase() };
  }, { revalidateOnFocus: false });
  if (!person || !user || person.id === user.id) return null;
  return (
    <div className="mt-7 flex flex-wrap items-center gap-3 rounded-card bg-raised p-4 ring-1 ring-inset ring-line-strong">
      <Avatar src={person.avatarUrl} name={person.username} size="lg" />
      <p className="min-w-0 flex-1 text-sm text-ink-300">
        <span className="font-semibold text-ink-0">{person.username}</span> invited you. When you finish, you&apos;ll go straight to them.
      </p>
      <FollowerBtnClient profileId={person.id} currentUserId={user.id} initialStatus="follow" profileVisibility={person.visibility} />
    </div>
  );
}

function StepPeople({ username, onFinish, leaving }: { username: string | null; onFinish: () => void; leaving: boolean }) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Recipients | null>(null);
  const q = query.trim();

  // People whose taste is close to yours, when there are any: the list is
  // worked out overnight, so a brand-new account often has none yet — and
  // then this simply isn't shown, rather than an empty box blaming the site.
  const { data: matches } = useSWR<Match[]>(me ? ["welcome-neighbours", me] : null, () => fetchMyNeighbours(3).catch(() => []), { revalidateOnFocus: false });

  useEffect(() => {
    if (!me || q.length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      const r = await fetchRecipients(me, q).catch(() => null);
      if (!stale) setFound(r);
    }, 300);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [me, q]);

  const people = q.length >= 2 && found ? [...found.connections, ...found.others].slice(0, 6) : [];

  return (
    <section>
      <Heading title="Know anyone here?" lead="Follow people to see what they watch and love. No one yet? That's fine — skip this, and find people any time from People." />

      <InvitedBy />

      <label htmlFor="welcome-find" className="mt-7 block text-sm font-medium text-ink-300">
        Find someone by username
      </label>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          id="welcome-find"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Their username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 w-full rounded-xl bg-overlay/60 pl-9 pr-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </div>
      {q.length >= 2 && found && (
        people.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No one by that name yet. You could send them your link instead.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar src={p.avatarUrl} name={p.username} size={36} />
                <span className="min-w-0 flex-1 truncate text-base text-ink-0">{p.username}</span>
                <FollowButton targetUserId={p.id} currentUserId={me} initialStatus={"following" in p && p.following ? "following" : "follow"} size="sm" />
              </li>
            ))}
          </ul>
        )
      )}

      {matches && matches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl text-ink-0">People with your taste</h2>
          <ul className="mt-3 divide-y divide-line">
            {matches.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-3">
                <Avatar src={m.avatarUrl} name={m.username} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink-0">{m.username}</p>
                  <p className="truncate text-sm text-ink-500">{m.icebreaker}</p>
                </div>
                <FollowButton targetUserId={m.userId} currentUserId={me} initialStatus="follow" size="sm" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-card bg-raised p-4 ring-1 ring-inset ring-line-strong">
        <p className="min-w-0 flex-1 text-sm text-ink-300">Someone you watch with isn&apos;t on letsee yet?</p>
        <button
          type="button"
          onClick={() => void inviteSomeone(username)}
          className="inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
        >
          Send them a link
        </button>
      </div>

      <Actions primary="Go to letsee" onPrimary={onFinish} busy={leaving} />
      <p className="mt-4 text-center text-sm text-ink-500">
        Once you&apos;re in: mark what you&apos;ve seen in a minute with fast mode (the + Add button, top right), or bring your history from Letterboxd, Trakt, TV Time, IMDb or Netflix.
      </p>
    </section>
  );
}
