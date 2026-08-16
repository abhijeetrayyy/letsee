"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Search, Loader2, ArrowRight, Users } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { getPosterUrl } from "@/utils/imageUrl";
import Avatar from "@components/ui/Avatar";
import FollowButton from "@components/profile/FollowButton";
import SendMessageModal from "@components/message/sendCard";

const USERNAME_MIN = 2;
const USERNAME_MAX = 15;
const DEBOUNCE_MS = 400;
const PICKS_REQUIRED = 4;

function sanitizeUsername(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function validateUsername(s: string): string {
  if (!s) return "Enter a username.";
  if (s.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (s.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`;
  if (s === "null" || s === "undefined") return "That username isn't allowed.";
  return "";
}

type Pick = {
  itemId: string;
  itemType: "movie" | "tv";
  name: string;
  posterPath: string | null;
  genres: string[];
};

type SharedTitle = { name: string; viewers: number; totalUsers: number };
type Match = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  about: string | null;
  sharedCount: number;
  sharedTitles: SharedTitle[];
  icebreaker: string;
};

type TmdbResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  genre_ids?: number[];
};

export default function WelcomePage() {
  const router = useRouter();
  const { user, status, refresh } = useAuth();
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (status === "anon") router.replace("/login");
    // Someone who already has a handle doesn't need onboarding.
    if (status === "ok") setStep((s) => (s === 1 ? 2 : s));
  }, [status, router]);

  // Otherwise the new step renders behind the sticky header at whatever scroll
  // position the previous step left behind.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  return (
    <div className="min-h-screen w-full bg-surface-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Stepper step={step} />

        {step === 1 && (
          <StepUsername
            onDone={async () => {
              await refresh();
              setStep(2);
            }}
          />
        )}
        {step === 2 && <StepPicks onDone={() => setStep(3)} />}
        {step === 3 && <StepPeople username={user?.username ?? null} />}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Your handle", "Films you love", "Your people"];
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? "bg-brand-500 text-surface-950"
                  : active
                    ? "bg-brand-500/20 text-brand-300 border border-brand-500/40"
                    : "bg-surface-800 text-surface-500"
              }`}
            >
              {done ? <Check className="size-3.5" /> : n}
            </span>
            <span
              className={`text-xs truncate ${active ? "text-white font-medium" : "text-surface-500"}`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 1: claim a handle ─────────────────────────────────────────────── */

function StepUsername({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clean = sanitizeUsername(username);
  const validationError = validateUsername(clean);

  useEffect(() => {
    setAvailable(null);
    if (timer.current) clearTimeout(timer.current);
    if (validationError) return;

    timer.current = setTimeout(async () => {
      setChecking(true);
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("username", clean)
        .maybeSingle();
      setAvailable(!data);
      setChecking(false);
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [clean, validationError]);

  const save = async () => {
    if (validationError || available === false) return;
    setSaving(true);
    setError("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setError("Session expired — please log in again.");
      setSaving(false);
      return;
    }
    const { error: err } = await supabase
      .from("users")
      .update({ username: clean })
      .eq("id", auth.user.id);
    setSaving(false);
    if (err) {
      setError(err.message.includes("duplicate") ? "That handle is taken." : err.message);
      return;
    }
    onDone();
  };

  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pick your handle</h1>
      <p className="mt-2 text-sm text-surface-400">
        This is how people will find you. You can change it later.
      </p>

      <div className="mt-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500">@</span>
          <input
            autoFocus
            value={clean}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="moviefan"
            maxLength={USERNAME_MAX}
            className="w-full rounded-xl bg-surface-800 border border-surface-700 pl-9 pr-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="mt-2 h-5 text-xs">
          {clean && validationError && <span className="text-red-400">{validationError}</span>}
          {!validationError && checking && <span className="text-surface-500">Checking…</span>}
          {!validationError && !checking && available === true && (
            <span className="text-brand-400">@{clean} is available</span>
          )}
          {!validationError && !checking && available === false && (
            <span className="text-red-400">@{clean} is taken</span>
          )}
          {error && <span className="text-red-400">{error}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!!validationError || available !== true || saving}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-semibold text-surface-950 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Continue
      </button>
    </section>
  );
}

/* ── Step 2: pick films you love (seeds the matcher) ────────────────────── */

function StepPicks({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [saving, setSaving] = useState(false);

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
        const res = await fetch(
          `/api/search?query=${encodeURIComponent(q)}&media_type=multi`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setResults(
          (data?.results ?? [])
            .filter((r: TmdbResult) => r.media_type !== "person" && (r.title || r.name))
            .slice(0, 8),
        );
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
    if (picks.length >= PICKS_REQUIRED) return;
    setPicks((prev) => [
      ...prev,
      {
        itemId,
        itemType: r.media_type === "tv" ? "tv" : "movie",
        name: r.title || r.name || "",
        posterPath: r.poster_path ?? null,
        genres: [],
      },
    ]);
    setQuery("");
    setResults([]);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Two writes on purpose: favorite_display drives the profile strip,
      // favorite_items is what the taste matcher actually reads.
      await fetch("/api/profile/favorite-display", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: picks.map((p) => ({
            item_id: p.itemId,
            item_type: p.itemType,
            item_name: p.name,
            image_url: p.posterPath ? getPosterUrl(p.posterPath, "w342") : undefined,
          })),
        }),
      });

      await Promise.all(
        picks.map((p) =>
          fetch("/api/favoriteButton", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: p.itemId,
              name: p.name,
              mediaType: p.itemType,
              imgUrl: p.posterPath ? getPosterUrl(p.posterPath, "w342") : null,
              genres: p.genres,
            }),
          }),
        ),
      );
    } catch (e) {
      console.error("Failed to save picks:", e);
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
        Pick {PICKS_REQUIRED} films you love
      </h1>
      <p className="mt-2 text-sm text-surface-400">
        The more unusual your picks, the better we can find your people. Obscure is good.
      </p>

      {/* Chosen */}
      <div className="mt-6 grid grid-cols-4 gap-3">
        {Array.from({ length: PICKS_REQUIRED }).map((_, i) => {
          const p = picks[i];
          return p ? (
            <button
              key={p.itemId}
              type="button"
              onClick={() => setPicks((prev) => prev.filter((x) => x.itemId !== p.itemId))}
              className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-surface-700"
              title={`Remove ${p.name}`}
            >
              <img
                src={getPosterUrl(p.posterPath, "w185")}
                alt={p.name}
                className="w-full h-full object-cover"
              />
              <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-medium">
                Remove
              </span>
            </button>
          ) : (
            <div
              key={`empty-${i}`}
              className="aspect-[2/3] rounded-xl border border-dashed border-surface-700/70 bg-surface-900/40"
            />
          );
        })}
      </div>

      {/* Search */}
      <div className="mt-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-surface-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any film or show…"
          className="w-full rounded-xl bg-surface-800 border border-surface-700 pl-10 pr-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-surface-500" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="mt-2 rounded-xl border border-surface-700 bg-surface-900 overflow-hidden divide-y divide-surface-800">
          {results.map((r) => (
            <li key={`${r.media_type}-${r.id}`}>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={picks.length >= PICKS_REQUIRED}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-800 disabled:opacity-40 transition-colors"
              >
                <img
                  src={getPosterUrl(r.poster_path, "w92")}
                  alt=""
                  className="w-8 aspect-[2/3] object-cover rounded"
                />
                <span className="text-sm text-surface-200 truncate">{r.title || r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={picks.length < PICKS_REQUIRED || saving}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-semibold text-surface-950 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {picks.length < PICKS_REQUIRED
            ? `Pick ${PICKS_REQUIRED - picks.length} more`
            : "Find my people"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-surface-500 hover:text-surface-300 px-2"
        >
          Skip
        </button>
      </div>
    </section>
  );
}

/* ── Step 3: meet people, and follow at least one ───────────────────────── */

function StepPeople({ username }: { username: string | null }) {
  const router = useRouter();
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(0);
  const [dmTarget, setDmTarget] = useState<Match | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/taste-matches?limit=3");
      const data = await res.json();
      setMatches(data?.matches ?? []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const finish = () => router.push("/app");

  return (
    <section>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your people</h1>
      <p className="mt-2 text-sm text-surface-400">
        Follow at least one person so your feed has something in it.
      </p>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-900/50 animate-pulse" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="mt-6 rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 text-center">
          <Users className="size-8 text-surface-600 mx-auto mb-3" />
          <p className="text-sm text-surface-400">
            No taste matches yet — you may be one of the first here.
          </p>
          <Link
            href="/app/profile"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-400 hover:text-brand-300"
          >
            Browse everyone <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {matches.map((m) => (
            <li
              key={m.userId}
              className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4"
            >
              <div className="flex items-start gap-3">
                <Link href={`/app/profile/${m.username}`} className="shrink-0">
                  <Avatar src={m.avatarUrl} name={m.username} size="lg" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/profile/${m.username}`}
                    className="font-semibold text-white hover:text-brand-400 transition-colors"
                  >
                    @{m.username}
                  </Link>
                  {/* The evidence is the point — not a match percentage. */}
                  <p className="mt-1 text-sm text-brand-300">{m.icebreaker}</p>
                  {m.sharedCount > 1 && (
                    <p className="mt-0.5 text-xs text-surface-500">
                      {m.sharedCount} titles in common
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <FollowButton
                      targetUserId={m.userId}
                      currentUserId={user?.id ?? null}
                      initialStatus="follow"
                      size="sm"
                      onStatusChange={(s) =>
                        setFollowed((c) => (s === "following" ? c + 1 : Math.max(0, c - 1)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setDmTarget(m)}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/20 transition-colors"
                    >
                      Say hi
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={finish}
        className={`mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition-colors ${
          followed > 0 || matches.length === 0
            ? "bg-brand-500 text-surface-950 hover:bg-brand-400"
            : "bg-surface-800 text-surface-400 hover:bg-surface-700"
        }`}
      >
        {followed > 0 || matches.length === 0
          ? "Enter LetSee"
          : "Skip for now"}
        <ArrowRight className="size-4" />
      </button>

      {/* A brand new profile is empty, which is the least interesting version
          of the product. Offer the fast way to fill it before they land. */}
      <Link
        href="/app/quick-add"
        className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-medium bg-surface-800/70 text-surface-200 border border-surface-700/60 hover:bg-surface-700 transition-colors"
      >
        First, log what I&apos;ve already seen
      </Link>

      {username && (
        <p className="mt-3 text-center text-xs text-surface-600">
          You&apos;re @{username}
        </p>
      )}

      <SendMessageModal
        isOpen={!!dmTarget}
        onClose={() => setDmTarget(null)}
        data={null}
        media_type={null}
        initialMessage={dmTarget?.icebreaker}
        preselectedUser={
          dmTarget ? { id: dmTarget.userId, username: dmTarget.username } : undefined
        }
      />
    </section>
  );
}
