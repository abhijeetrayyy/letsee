"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Loader2,
  MonitorPlay,
  RotateCcw,
  Settings2,
  Users,
} from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { getAvatarUrl, getPosterUrl } from "@/utils/imageUrl";
import ServicePicker from "./ServicePicker";

type Person = { userId: string; username: string; avatarUrl: string | null; mutual: boolean };

type Provider = { id: number; name: string; logoPath: string | null; heldBy: string[] };

type Episode = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  stillPath: string | null;
};

type Candidate = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  backdropUrl: string | null;
  year: string | null;
  overview: string;
  genres: string[];
  runtime: number | null;
  voteAverage: number;
  providers: Provider[];
  reason: string;
  episode: Episode | null;
};

type Participant = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** False when they never set their services — the API has always sent this. */
  hasProviders: boolean;
  isYou: boolean;
};

type SessionResponse = {
  sessionId: number;
  participants: Participant[];
  pick: Candidate | null;
  alternates: Candidate[];
};

const RUNTIME_CHOICES = [
  { label: "Any length", value: null },
  { label: "Under 90 min", value: 90 },
  { label: "Under 2 hours", value: 120 },
];

const TYPE_CHOICES = [
  { label: "Either", value: "any" as const },
  { label: "Film", value: "movie" as const },
  { label: "TV", value: "tv" as const },
];

/**
 * The room.
 *
 * One answer, one reason, two buttons. The temptation with everything the
 * resolver returns is to render a grid of it — and a grid is exactly what this
 * screen exists not to be. The alternates are held in memory purely so "Next"
 * is instant; they are never all on screen at once.
 */
export default function TonightRoom({ hasProviders }: { hasProviders: boolean }) {
  const { data: peopleData } = useSWR<{ people: Person[] }>("/api/tonight/people", swrFetcher);

  const [showPicker, setShowPicker] = useState(!hasProviders);
  const [withIds, setWithIds] = useState<Set<string>>(new Set());
  const [maxRuntime, setMaxRuntime] = useState<number | null>(null);
  const [mediaType, setMediaType] = useState<"any" | "movie" | "tv">("any");

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [queue, setQueue] = useState<Candidate[]>([]);
  const [pick, setPick] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const people = peopleData?.people ?? [];

  /**
   * Anyone in the room who never set their services. The resolver treats them
   * as "any provider" so they don't empty the candidate pool — which means a
   * pick can be one they personally can't play. That's a reasonable fallback
   * and a terrible silence, so it gets said out loud on the answer.
   */
  const unaccounted = (session?.participants ?? []).filter((p) => !p.hasProviders);

  const usernameFor = useCallback(
    (userId: string) =>
      session?.participants.find((p) => p.userId === userId)?.username ??
      people.find((p) => p.userId === userId)?.username ??
      null,
    [session, people],
  );

  const applyResult = useCallback((data: SessionResponse) => {
    setSession(data);
    setPick(data.pick);
    setQueue(data.alternates ?? []);
    if (!data.pick) setError("Nothing fits those constraints. Try loosening them.");
  }, []);

  const start = async () => {
    setLoading(true);
    setError(null);
    setDecided(null);
    try {
      const res = await fetch("/api/tonight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: [...withIds],
          maxRuntime,
          mediaType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not find anything");
      applyResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * "Next" is a rejection, not a shuffle — the server records it so the title
   * stays out for the rest of the session. The queued alternate shows
   * immediately while that round trip happens; waiting on the network to move
   * past something you've already said no to is the one delay this screen
   * can't afford.
   */
  const next = async () => {
    if (!session || !pick) return;
    const rejected = pick;
    const [upcoming, ...rest] = queue;
    if (upcoming) {
      setPick(upcoming);
      setQueue(rest);
    } else {
      setBusy(true);
    }

    try {
      const res = await fetch(`/api/tonight/${session.sessionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: rejected.itemId, itemType: rejected.itemType, vote: "out" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not skip that");
      if (!upcoming) {
        setPick(data.pick);
        setQueue(data.alternates ?? []);
        if (!data.pick) setError("That's everything we could find. Try loosening the constraints.");
      } else {
        // Keep the queue fresh with the server's newer ranking.
        setQueue((current) =>
          current.length > 0
            ? current
            : (data.alternates ?? []).filter((c: Candidate) => c.itemId !== upcoming.itemId),
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async () => {
    if (!session || !pick) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tonight/${session.sessionId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: pick.itemId,
          itemType: pick.itemType,
          itemName: pick.itemName,
          imageUrl: pick.imageUrl ? getPosterUrl(pick.imageUrl, "w342") : null,
          genres: pick.genres,
          runtime: pick.runtime,
          // Present only for a "next episode" answer, which logs that episode
          // rather than just re-affirming the show as in progress.
          ...(pick.episode
            ? {
                seasonNumber: pick.episode.seasonNumber,
                episodeNumber: pick.episode.episodeNumber,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not save that");
      setDecided(pick);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSession(null);
    setPick(null);
    setQueue([]);
    setDecided(null);
    setError(null);
  };

  if (showPicker) {
    return (
      <ServicePicker
        onSaved={() => setShowPicker(false)}
        onCancel={hasProviders ? () => setShowPicker(false) : undefined}
      />
    );
  }

  if (decided) {
    return <Decided candidate={decided} onAgain={reset} />;
  }

  if (pick) {
    return (
      <Answer
        candidate={pick}
        participantCount={session?.participants.length ?? 1}
        usernameFor={usernameFor}
        unaccounted={unaccounted}
        busy={busy}
        error={error}
        onWatch={decide}
        onNext={next}
        onBack={reset}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionLabel icon={<Users className="size-4" />} text="Who's watching" />
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-500/15 px-3.5 py-2 text-sm text-brand-300">
            <Check className="size-3.5" />
            You
          </span>
          {people.map((person) => {
            const on = withIds.has(person.userId);
            return (
              <button
                key={person.userId}
                type="button"
                onClick={() =>
                  setWithIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(person.userId)) next.delete(person.userId);
                    else next.add(person.userId);
                    return next;
                  })
                }
                aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm transition ${
                  on
                    ? "border-brand-500 bg-brand-500/15 text-brand-300"
                    : "border-surface-700 bg-surface-950/60 text-surface-300 hover:border-surface-600 hover:text-white"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getAvatarUrl(person.avatarUrl)}
                  alt=""
                  className="size-6 rounded-full object-cover"
                />
                {person.username}
              </button>
            );
          })}
          {people.length === 0 && (
            <p className="text-surface-500 text-sm py-1">
              Follow someone to decide together.{" "}
              <Link href="/app/search" className="text-brand-400 hover:text-brand-300">
                Find people
              </Link>
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionLabel icon={<Clock className="size-4" />} text="How long have you got" />
        <div className="mt-3 flex flex-wrap gap-2">
          {RUNTIME_CHOICES.map((choice) => (
            <Chip
              key={choice.label}
              active={maxRuntime === choice.value}
              onClick={() => setMaxRuntime(choice.value)}
            >
              {choice.label}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel icon={<MonitorPlay className="size-4" />} text="Film or TV" />
        <div className="mt-3 flex flex-wrap gap-2">
          {TYPE_CHOICES.map((choice) => (
            <Chip
              key={choice.value}
              active={mediaType === choice.value}
              onClick={() => setMediaType(choice.value)}
            >
              {choice.label}
            </Chip>
          ))}
        </div>
      </section>

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          type="button"
          onClick={start}
          disabled={loading}
          className="btn-primary text-base px-7 py-3 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Deciding…
            </>
          ) : (
            <>
              Decide for us
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition"
        >
          <Settings2 className="size-4" />
          My services
        </button>
      </div>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-surface-500">
      {icon}
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em]">{text}</h2>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-2 text-sm transition ${
        active
          ? "border-brand-500 bg-brand-500/15 text-brand-300"
          : "border-surface-700 bg-surface-950/60 text-surface-300 hover:border-surface-600 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Answer({
  candidate,
  participantCount,
  usernameFor,
  unaccounted,
  busy,
  error,
  onWatch,
  onNext,
  onBack,
}: {
  candidate: Candidate;
  participantCount: number;
  usernameFor: (userId: string) => string | null;
  unaccounted: Participant[];
  busy: boolean;
  error: string | null;
  onWatch: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const ep = candidate.episode;
  const meta = [
    ep ? `Season ${ep.seasonNumber}, Episode ${ep.episodeNumber}` : candidate.year,
    candidate.runtime ? `${candidate.runtime} min` : null,
    candidate.genres.slice(0, 2).join(", ") || null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-8">
        <Link
          href={`/app/${candidate.itemType}/${candidate.itemId}`}
          className="block shrink-0 mx-auto sm:mx-0 w-[180px] sm:w-[200px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getPosterUrl(candidate.imageUrl, "w342")}
            alt={candidate.itemName}
            className="w-full rounded-2xl border border-surface-800 object-cover shadow-2xl shadow-black/50"
          />
        </Link>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
            {ep ? "Pick up where you left off" : "Watch this"}
          </p>
          {/* For an episode the show is the identity and the episode is the
              answer, so the show name leads and the episode title sits under
              it rather than replacing it. */}
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white leading-tight">
            <Link href={`/app/${candidate.itemType}/${candidate.itemId}`} className="hover:text-brand-300 transition">
              {candidate.itemName}
            </Link>
          </h1>
          {ep && (
            <p className="mt-1 text-lg text-surface-200">
              <Link
                href={`/app/tv/${candidate.itemId}/season/${ep.seasonNumber}`}
                className="hover:text-brand-300 transition"
              >
                {ep.name}
              </Link>
            </p>
          )}
          {meta.length > 0 && (
            <p className="mt-1.5 text-sm text-surface-400">{meta.join(" · ")}</p>
          )}

          {/* The reason is the product. Everything else on this screen is
              context for it. */}
          <p className="mt-4 text-base text-surface-200">{candidate.reason}</p>

          {candidate.providers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {candidate.providers.slice(0, 4).map((provider) => {
                const holders = provider.heldBy
                  .map(usernameFor)
                  .filter((n): n is string => !!n);
                const attribution =
                  participantCount > 1 && holders.length === 1 ? ` · ${holders[0]}` : "";
                return (
                  <span
                    key={provider.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-800 bg-surface-900/60 px-2.5 py-1.5 text-xs text-surface-300"
                  >
                    {provider.logoPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getPosterUrl(provider.logoPath, "w92")}
                        alt=""
                        className="size-4 rounded"
                      />
                    )}
                    {provider.name}
                    {attribution}
                  </span>
                );
              })}
            </div>
          )}

          {/* The availability caveat, stated rather than swallowed. Without
              their services we can't know whether this is on anything they
              have, and quietly presenting it as "streamable by the room" would
              be the tool overstating what it knows. */}
          {unaccounted.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-300/90">
              <AlertCircle className="size-3.5 shrink-0 translate-y-px" />
              <span>
                {unaccounted.length === 1
                  ? unaccounted[0].isYou
                    ? "You haven't set your services, so we couldn't check this is on anything you have."
                    : `${unaccounted[0].username} hasn't set their services, so we couldn't check this is on anything they have.`
                  : `${unaccounted.length} people here haven't set their services, so we couldn't check this is on anything they have.`}
              </span>
            </p>
          )}

          {candidate.overview && (
            <p className="mt-4 text-sm text-surface-400 line-clamp-3">{candidate.overview}</p>
          )}
        </div>
      </div>

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onWatch}
          disabled={busy}
          className="btn-primary text-base px-7 py-3 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {ep ? "Play this episode" : "We're watching this"}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={busy}
          className="rounded-xl border border-surface-700 px-5 py-3 text-sm text-surface-300 hover:border-surface-600 hover:text-white transition disabled:opacity-60"
        >
          Not this
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-surface-500 hover:text-surface-300 transition"
        >
          Change the room
        </button>
      </div>
    </div>
  );
}

function Decided({ candidate, onAgain }: { candidate: Candidate; onAgain: () => void }) {
  return (
    <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 sm:p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-500/15">
        <Check className="size-6 text-brand-400" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-white">Enjoy {candidate.itemName}.</h1>
      <p className="mt-2 text-sm text-surface-400">
        {candidate.episode
          ? `S${candidate.episode.seasonNumber}E${candidate.episode.episodeNumber} is marked watched. Next one's ready when you are.`
          : "It's on your list as currently watching. Rate it when you're done."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/app/${candidate.itemType}/${candidate.itemId}`}
          className="btn-primary text-sm px-5 py-2.5"
        >
          Open {candidate.itemType === "tv" ? "show" : "film"}
        </Link>
        <button
          type="button"
          onClick={onAgain}
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition"
        >
          <RotateCcw className="size-4" />
          Decide something else
        </button>
      </div>
    </div>
  );
}
