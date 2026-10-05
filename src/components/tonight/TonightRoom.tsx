"use client";

import { useCallback, useState } from "react";
import Link from "@components/ui/AppLink";
import useSWR from "swr";
import toast from "react-hot-toast";
import { AlertCircle, Check, Loader2, RotateCcw, Settings2 } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { swrFetcher } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";
import { prefillIds } from "@/lib/people/tonight";
import ServicePicker from "./ServicePicker";

type Person = { userId: string; username: string; avatarUrl: string | null; mutual: boolean };

type Provider = { id: number; name: string; logoPath: string | null; heldBy: string[] };

import { episodePath, titlePath } from "@/utils/urls";
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
  { label: "A film", value: "movie" as const },
  { label: "A series", value: "tv" as const },
];

const primary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-action px-6 text-base font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60";
const quiet =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 disabled:opacity-60";

/**
 * The room.
 *
 * One answer, one reason, two buttons. The temptation with everything the
 * resolver returns is to render a grid of it — and a grid is exactly what this
 * screen exists not to be. The alternates are held in memory purely so "Next"
 * is instant; they are never all on screen at once.
 */
export type TonightClub = { slug: string; name: string; admitted: boolean; members: { userId: string; username: string; avatarUrl: string | null }[] };

/** The server's limit: you and seven others. */
const MAX_OTHERS = 7;

export default function TonightRoom({ hasProviders, prefill = [], club = null, me = null }: { hasProviders: boolean; prefill?: string[]; club?: TonightClub | null; me?: string | null }) {
  // Keyed on who is asking: a sign-out and sign-in in the same tab mustn't show the last account's people.
  const { data: connections } = useSWR<{ people: Person[] }>(["/api/tonight/people", me], ([url]: [string, string | null]) => swrFetcher(url));
  // A group room's members can decide together whether or not they follow
  // one another (migration 107; the API checks membership).
  // A group's members are offered whether or not you follow them only when
  // the group admits its members (the API's rule); in an open group, only
  // the members you're connected to.
  const connected = new Set((connections?.people ?? []).map((p) => p.userId));
  const groupPeople = (club?.members ?? []).filter((m) => m.userId !== me && (club?.admitted || connected.has(m.userId)));
  const peopleData = connections
    ? {
        people: [
          ...groupPeople.map((m) => ({ ...m, mutual: connected.has(m.userId) })),
          ...connections.people.filter((p) => !groupPeople.some((m) => m.userId === p.userId)),
        ],
      }
    : undefined;
  if (club) prefill = [...prefill, ...groupPeople.map((m) => m.username.toLowerCase())].slice(0, MAX_OTHERS);

  const [showPicker, setShowPicker] = useState(!hasProviders);
  // Who the link said, once your people have loaded; your own taps after that.
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const withIds = picked ?? prefillIds(peopleData?.people ?? [], prefill);
  const setWithIds = (update: (prev: Set<string>) => Set<string>) => {
    const next = update(withIds);
    if (next.size > MAX_OTHERS) {
      toast.error("Up to eight of you at once.");
      return;
    }
    setPicked(next);
  };
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
          ...(club ? { clubSlug: club.slug } : {}),
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
    <div className="flex flex-col gap-8">
      <section aria-labelledby="who">
        <h2 id="who" className="mb-3 text-xl text-ink-0">
          {club ? <>Who&apos;s watching from {club.name}</> : <>Who&apos;s watching</>}
        </h2>
        <ul className="flex flex-wrap gap-2">
          <li>
            <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-action px-4 text-sm font-medium text-on-action">
              <Check className="size-4" aria-hidden />
              You
            </span>
          </li>
          {people.map((person) => {
            const on = withIds.has(person.userId);
            return (
              <li key={person.userId}>
                <button
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
                  className={`inline-flex h-10 items-center gap-2 rounded-full pl-1.5 pr-4 text-sm font-medium transition-colors ${
                    on ? "bg-action text-on-action" : "text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
                  }`}
                >
                  <Avatar src={person.avatarUrl} name={person.username} size={28} />
                  {person.username}
                </button>
              </li>
            );
          })}
        </ul>
        {peopleData && people.length === 0 && (
          <p className="mt-3 text-sm text-ink-400">
            Tonight can decide for you alone. To decide with someone, follow them or start a room with them.{" "}
            <Link href="/app/people/find" className="font-medium text-ink-0 underline decoration-line-input underline-offset-4">
              Find people
            </Link>
          </p>
        )}
      </section>

      <section aria-labelledby="how-long">
        <h2 id="how-long" className="mb-3 text-xl text-ink-0">
          How long have you got
        </h2>
        <div className="flex flex-wrap gap-2">
          {RUNTIME_CHOICES.map((choice) => (
            <Chip key={choice.label} active={maxRuntime === choice.value} onClick={() => setMaxRuntime(choice.value)}>
              {choice.label}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="what-kind">
        <h2 id="what-kind" className="mb-3 text-xl text-ink-0">
          A film or a series
        </h2>
        <div className="flex flex-wrap gap-2">
          {TYPE_CHOICES.map((choice) => (
            <Chip key={choice.value} active={mediaType === choice.value} onClick={() => setMediaType(choice.value)}>
              {choice.label}
            </Chip>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={start} disabled={loading} className={`${primary} w-full sm:w-auto`}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {loading ? "Deciding…" : withIds.size ? `Decide for the ${withIds.size + 1} of us` : "Decide for me"}
        </button>
        <button type="button" onClick={() => setShowPicker(true)} className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-0">
          <Settings2 className="size-4" aria-hidden />
          Your services
        </button>
      </div>
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

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
      className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${
        active ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
        <Link href={titlePath(candidate.itemType, candidate.itemId, candidate.itemName)} className="block w-40 shrink-0 self-center sm:w-48 sm:self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getPosterUrl(candidate.imageUrl, "w342")} alt="" className="aspect-2/3 w-full rounded-media object-cover ring-1 ring-inset ring-line" />
        </Link>

        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-500">{ep ? "Pick up where you left off" : "Watch this"}</p>
          {/* For an episode the show is the identity and the episode is the
              answer, so the show name leads and the episode title sits under it. */}
          <h2 className="mt-2 text-3xl leading-tight text-ink-0">
            <Link href={titlePath(candidate.itemType, candidate.itemId, candidate.itemName)} className="hover:underline hover:decoration-line-input hover:underline-offset-4">
              {candidate.itemName}
            </Link>
          </h2>
          {ep && (
            <p className="mt-1 text-lg text-ink-200">
              <Link href={episodePath(candidate.itemId, ep.seasonNumber, ep.episodeNumber, candidate.itemName)} className="hover:underline hover:underline-offset-4">
                {ep.name}
              </Link>
            </p>
          )}
          {meta.length > 0 && <p className="mt-1.5 text-sm text-ink-400">{meta.join(" · ")}</p>}

          {/* The reason is the product. Everything else on this screen is context for it. */}
          <p className="mt-4 font-display text-xl leading-snug text-ink-0">{candidate.reason}</p>

          {candidate.providers.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {candidate.providers.slice(0, 4).map((provider) => {
                const holders = provider.heldBy.map(usernameFor).filter((n): n is string => !!n);
                const attribution = participantCount > 1 && holders.length === 1 ? ` · ${holders[0]}` : "";
                return (
                  <li key={provider.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-raised pl-1.5 pr-3 text-xs text-ink-200 ring-1 ring-inset ring-line-strong">
                    {provider.logoPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getPosterUrl(provider.logoPath, "w92")} alt="" className="size-5 rounded-full" />
                    )}
                    {provider.name}
                    {attribution}
                  </li>
                );
              })}
            </ul>
          )}

          {/* The availability caveat, stated rather than swallowed. */}
          {unaccounted.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-300">
              <AlertCircle className="size-3.5 shrink-0 translate-y-px" aria-hidden />
              <span>
                {unaccounted.length === 1
                  ? unaccounted[0].isYou
                    ? "You haven't set your services, so we couldn't check this is on anything you have."
                    : `${unaccounted[0].username} hasn't set their services, so we couldn't check this is on anything they have.`
                  : `${unaccounted.length} people here haven't set their services, so we couldn't check this is on anything they have.`}
              </span>
            </p>
          )}

          {candidate.overview && <p className="mt-4 line-clamp-3 text-sm text-ink-400">{candidate.overview}</p>}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onWatch} disabled={busy} className={`${primary} w-full sm:w-auto`}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          {ep ? "We're watching this episode" : "We're watching this"}
        </button>
        <button type="button" onClick={onNext} disabled={busy} className={quiet}>
          Not this
        </button>
        <button type="button" onClick={onBack} className="text-sm text-ink-500 transition-colors hover:text-ink-0">
          Change who&apos;s watching
        </button>
      </div>
    </div>
  );
}

function Decided({ candidate, onAgain }: { candidate: Candidate; onAgain: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-line-strong bg-raised/40 p-6 text-center sm:p-8">
      <span className="flex size-12 items-center justify-center rounded-full bg-action text-on-action">
        <Check className="size-6" aria-hidden />
      </span>
      <h2 className="text-2xl text-ink-0">Enjoy {candidate.itemName}.</h2>
      <p className="text-sm text-ink-400">
        {candidate.episode
          ? `S${String(candidate.episode.seasonNumber).padStart(2, "0")} · E${String(candidate.episode.episodeNumber).padStart(2, "0")} is marked watched. The next one's ready when you are.`
          : "It's in Up next as watching. Log it when you're done, and say who was there."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={titlePath(candidate.itemType, candidate.itemId, candidate.itemName)} className={primary}>
          Open the {candidate.itemType === "tv" ? "series" : "film"}
        </Link>
        <button type="button" onClick={onAgain} className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-0">
          <RotateCcw className="size-4" aria-hidden />
          Decide something else
        </button>
      </div>
    </div>
  );
}
