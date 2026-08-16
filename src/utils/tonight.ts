/**
 * Tonight — the group decision engine.
 *
 * Everything else in this app is retrospective: you watched a thing, you log
 * it, you rate it. This is the one surface that runs *before* the watch, with
 * more than one person in the room, and it has to produce a single answer
 * rather than a wall of candidates. A carousel is not a decision.
 *
 * Three rules shape the whole file:
 *
 *   1. **Availability is a hard filter, not a signal.** A pick nobody can
 *      actually play costs the same attention as a good one and returns
 *      nothing. Titles that survive scoring still get dropped at hydration if
 *      no participant holds a service carrying them.
 *
 *   2. **Taste fit uses the MINIMUM across participants, never the mean.** A
 *      movie night fails if one person hates the pick. A mean lets an
 *      enthusiast drag a veto-worthy title to the top; a minimum optimises for
 *      "nobody is unhappy", which is what a group watch actually wants.
 *
 *   3. **The reason is evidence, never a percentage.** 043_taste_matching.sql
 *      already argues this for people; it holds for titles too. "You both
 *      watchlisted it" is a reason. "87% match" is noise wearing a number.
 */

import type { createClient } from "@/utils/supabase/server";
import { fetchTmdbJson } from "@/utils/tmdbClient";
import { buildGenreVector, cosineSimilarity, type GenreVector } from "@/utils/genreVector";
import { GenreList } from "@/staticData/genreList";
import { MOODS } from "@/staticData/moodMapping";
import { buildEpisodeReason, findEpisodePicks, type EpisodePick } from "@/utils/tonightEpisodes";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Candidates scored before we spend a TMDB detail call on any of them. */
const HYDRATE_LIMIT = 14;
/** Alternates returned alongside the pick, for "Next" without a round trip. */
const ALTERNATE_COUNT = 4;
/** Discover pages per media type. Two is ~40 titles, enough to rank over. */
const DISCOVER_PAGES = 2;

const GENRE_NAME_BY_ID = new Map<number, string>(
  GenreList.genres.map((g: { id: number; name: string }) => [g.id, g.name]),
);

/**
 * Stored genres are *names* ("Action"), not ids — see statisticsGenre.tsx,
 * which renders them straight into chart labels. TMDB list responses only
 * carry genre_ids, so everything crossing that boundary is mapped here.
 *
 * The route this replaced (/api/what-to-watch) compared stored names against
 * String(genre_id), so "28" never matched "Action" and its taste term never
 * fired — every pick silently fell through to popularity. Hence the map.
 */
function genreNames(ids: number[] | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => GENRE_NAME_BY_ID.get(id)).filter((n): n is string => !!n);
}

export type MediaType = "movie" | "tv";

export type TonightConstraints = {
  region: string;
  maxRuntime: number | null;
  mediaType: "any" | MediaType;
  moods: string[];
  allowRewatch: boolean;
};

export type TonightParticipant = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Empty means "no services configured" — treated as unconstrained, not as zero. */
  providerIds: Set<number>;
  genreVector: GenreVector;
  /** Keyed by item_id alone: user_media_status's PK is (user_id, item_id). */
  statusByItem: Map<string, string>;
  watchlist: Set<string>;
};

export type TonightProvider = {
  id: number;
  name: string;
  logoPath: string | null;
  /** Participant ids whose services carry it. Empty for a group with none set. */
  heldBy: string[];
};

/** Set when the answer is "the next episode", not "this title". */
export type TonightEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  stillPath: string | null;
};

export type TonightCandidate = {
  itemId: string;
  itemType: MediaType;
  itemName: string;
  imageUrl: string | null;
  backdropUrl: string | null;
  year: string | null;
  overview: string;
  genres: string[];
  runtime: number | null;
  voteAverage: number;
  providers: TonightProvider[];
  reason: string;
  episode: TonightEpisode | null;
  /** Internal ranking figure. Never render it. */
  score: number;
};

type PoolEntry = {
  itemId: string;
  itemType: MediaType;
  itemName: string;
  imageUrl: string | null;
  backdropUrl: string | null;
  year: string | null;
  overview: string;
  genres: string[];
  voteAverage: number;
  voteCount: number;
  /** Participants who have it on their watchlist. */
  watchlistedBy: string[];
};

// ── Participants ────────────────────────────────────────────────────────────

/**
 * Everything the resolver needs about the room, in four queries rather than
 * four per person.
 */
export async function loadParticipants(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<TonightParticipant[]> {
  if (userIds.length === 0) return [];

  const [usersRes, providersRes, statusRes, favouritesRes] = await Promise.all([
    supabase.from("users").select("id, username, avatar_url").in("id", userIds),
    supabase.from("user_providers").select("user_id, provider_id").in("user_id", userIds),
    supabase
      .from("user_media_status")
      .select("user_id, item_id, status, genres")
      .in("user_id", userIds),
    supabase.from("favorite_items").select("user_id, genres").in("user_id", userIds),
  ]);

  const nameById = new Map(
    (usersRes.data ?? []).map((u) => [u.id as string, u as { username: string; avatar_url: string | null }]),
  );

  const providersByUser = new Map<string, Set<number>>();
  for (const row of providersRes.data ?? []) {
    const set = providersByUser.get(row.user_id) ?? new Set<number>();
    set.add(row.provider_id);
    providersByUser.set(row.user_id, set);
  }

  const statusByUser = new Map<string, Map<string, string>>();
  const genreRowsByUser = new Map<string, { genres?: string[] | null }[]>();
  for (const row of statusRes.data ?? []) {
    const statuses = statusByUser.get(row.user_id) ?? new Map<string, string>();
    statuses.set(String(row.item_id), row.status);
    statusByUser.set(row.user_id, statuses);

    // Only titles they actually engaged with describe their taste. A watchlist
    // is aspiration, and aspiration is a bad predictor of what someone enjoys.
    if (row.status === "watched" || row.status === "watching") {
      const rows = genreRowsByUser.get(row.user_id) ?? [];
      rows.push({ genres: row.genres });
      genreRowsByUser.set(row.user_id, rows);
    }
  }
  for (const row of favouritesRes.data ?? []) {
    const rows = genreRowsByUser.get(row.user_id) ?? [];
    rows.push({ genres: row.genres });
    genreRowsByUser.set(row.user_id, rows);
  }

  return userIds.map((userId) => {
    const statuses = statusByUser.get(userId) ?? new Map<string, string>();
    const watchlist = new Set<string>();
    for (const [itemId, status] of statuses) {
      if (status === "watchlist") watchlist.add(itemId);
    }
    return {
      userId,
      username: nameById.get(userId)?.username ?? "someone",
      avatarUrl: nameById.get(userId)?.avatar_url ?? null,
      providerIds: providersByUser.get(userId) ?? new Set<number>(),
      genreVector: buildGenreVector(genreRowsByUser.get(userId) ?? []),
      statusByItem: statuses,
      watchlist,
    };
  });
}

// ── Candidate pool ──────────────────────────────────────────────────────────

/**
 * Titles anyone in the room has already opted into. The strongest prior we
 * have: they put it on the list themselves, so we're reminding rather than
 * recommending.
 */
async function watchlistPool(
  supabase: SupabaseClient,
  participants: TonightParticipant[],
  constraints: TonightConstraints,
): Promise<PoolEntry[]> {
  const userIds = participants.map((p) => p.userId);
  const { data, error } = await supabase
    .from("user_media_status")
    .select("user_id, item_id, item_type, item_name, image_url, genres, item_adult, runtime_minutes")
    .in("user_id", userIds)
    .eq("status", "watchlist");

  if (error) {
    console.error("tonight watchlistPool:", error);
    return [];
  }

  const byItem = new Map<string, PoolEntry>();
  for (const row of data ?? []) {
    if (row.item_adult) continue;
    const itemType: MediaType = row.item_type === "tv" ? "tv" : "movie";
    if (constraints.mediaType !== "any" && constraints.mediaType !== itemType) continue;

    const itemId = String(row.item_id);
    const existing = byItem.get(itemId);
    if (existing) {
      existing.watchlistedBy.push(row.user_id);
      continue;
    }
    byItem.set(itemId, {
      itemId,
      itemType,
      itemName: row.item_name ?? "",
      imageUrl: row.image_url ?? null,
      backdropUrl: null,
      year: null,
      overview: "",
      genres: Array.isArray(row.genres) ? row.genres : [],
      // Unknown until hydration; a neutral prior keeps an unrated watchlist
      // title from being buried by a popular one before we've even looked.
      voteAverage: 6.5,
      voteCount: 0,
      watchlistedBy: [row.user_id],
    });
  }

  return [...byItem.values()];
}

/**
 * Fresh candidates from TMDB, pre-filtered on the group's services so the
 * availability gate rejects as little as possible later.
 */
async function discoverPool(
  participants: TonightParticipant[],
  constraints: TonightConstraints,
): Promise<PoolEntry[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  const providerUnion = new Set<number>();
  for (const p of participants) for (const id of p.providerIds) providerUnion.add(id);

  const moodGenres = new Set<number>();
  for (const mood of constraints.moods) {
    for (const g of MOODS[mood]?.genres ?? []) moodGenres.add(g);
  }

  const types: MediaType[] = constraints.mediaType === "any" ? ["movie", "tv"] : [constraints.mediaType];

  const requests: Promise<PoolEntry[]>[] = [];
  for (const type of types) {
    for (let page = 1; page <= DISCOVER_PAGES; page += 1) {
      const params = new URLSearchParams({
        api_key: apiKey,
        include_adult: "false",
        language: "en-US",
        sort_by: "popularity.desc",
        page: String(page),
        watch_region: constraints.region,
        "vote_count.gte": "50",
      });
      if (providerUnion.size > 0) {
        // Pipe is OR — see rule 2 in the doc: union, not intersection. A pick
        // on one person's account is still a pick the room can watch.
        params.set("with_watch_providers", [...providerUnion].join("|"));
        params.set("with_watch_monetization_types", "flatrate|free|ads");
      }
      if (moodGenres.size > 0) params.set("with_genres", [...moodGenres].join("|"));
      if (constraints.maxRuntime) params.set("with_runtime.lte", String(constraints.maxRuntime));

      requests.push(
        fetchTmdbJson<{ results?: Record<string, unknown>[] }>(
          `${TMDB_BASE}/discover/${type}?${params.toString()}`,
          { timeoutMs: 8000 },
        )
          .then((data) =>
            (data.results ?? []).map((r): PoolEntry => {
              const date = String(r.release_date ?? r.first_air_date ?? "");
              return {
                itemId: String(r.id),
                itemType: type,
                itemName: String(r.title ?? r.name ?? ""),
                imageUrl: r.poster_path ? String(r.poster_path) : null,
                backdropUrl: r.backdrop_path ? String(r.backdrop_path) : null,
                year: date ? date.slice(0, 4) : null,
                overview: String(r.overview ?? ""),
                genres: genreNames(r.genre_ids as number[]),
                voteAverage: Number(r.vote_average ?? 0),
                voteCount: Number(r.vote_count ?? 0),
                watchlistedBy: [],
              };
            }),
          )
          .catch((err) => {
            console.error("tonight discoverPool:", err);
            return [];
          }),
      );
    }
  }

  const pages = await Promise.all(requests);
  return pages.flat();
}

/**
 * How many people each participant follows have watched each candidate. The
 * only social term in the score, and the one that makes a pick feel like it
 * came from this community rather than from TMDB's popularity ranking.
 */
async function socialProofCounts(
  supabase: SupabaseClient,
  participants: TonightParticipant[],
  itemIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (itemIds.length === 0) return counts;

  const { data: connections } = await supabase
    .from("user_connections")
    .select("followed_id")
    .in("follower_id", participants.map((p) => p.userId));

  const followedIds = [...new Set((connections ?? []).map((c) => c.followed_id as string))];
  if (followedIds.length === 0) return counts;

  const { data } = await supabase
    .from("user_media_status")
    .select("item_id, user_id")
    .in("user_id", followedIds)
    .in("item_id", itemIds)
    .eq("status", "watched");

  for (const row of data ?? []) {
    const key = String(row.item_id);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

const WEIGHTS = {
  watchlistOverlap: 0.35,
  tasteFit: 0.3,
  quality: 0.2,
  socialProof: 0.15,
} as const;

type ScoredEntry = PoolEntry & {
  score: number;
  terms: { watchlistOverlap: number; tasteFit: number; quality: number; socialProof: number };
  followersWatched: number;
};

function scoreEntry(
  entry: PoolEntry,
  participants: TonightParticipant[],
  followersWatched: number,
): ScoredEntry {
  const watchlistOverlap = entry.watchlistedBy.length / participants.length;

  // Rule 2: minimum, not mean.
  const candidateVector = buildGenreVector([{ genres: entry.genres }]);
  let tasteFit = 1;
  for (const p of participants) {
    const sim = Object.keys(p.genreVector).length === 0
      ? 0.5 // No history yet — neutral, so a new user neither vetoes nor endorses.
      : cosineSimilarity(p.genreVector, candidateVector);
    tasteFit = Math.min(tasteFit, sim);
  }

  // Shrunk towards the mean so a 10/10 from nine voters loses to a 7.8 from
  // four thousand.
  const quality = (entry.voteAverage / 10) * (entry.voteCount / (entry.voteCount + 50));

  const socialProof = Math.min(1, Math.log1p(followersWatched) / Math.log(6));

  const terms = { watchlistOverlap, tasteFit, quality, socialProof };
  const score =
    WEIGHTS.watchlistOverlap * watchlistOverlap +
    WEIGHTS.tasteFit * tasteFit +
    WEIGHTS.quality * quality +
    WEIGHTS.socialProof * socialProof;

  return { ...entry, score, terms, followersWatched };
}

/**
 * The sentence under the poster. Always the term that actually earned the
 * pick, rendered as the evidence behind it — the same principle as
 * buildIcebreaker in tasteMatch.ts.
 */
function buildReason(
  entry: ScoredEntry,
  participants: TonightParticipant[],
  providers: TonightProvider[],
  runtime: number | null,
): string {
  const contributions: [keyof typeof WEIGHTS, number][] = (
    Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]
  ).map((key) => [key, WEIGHTS[key] * entry.terms[key]]);
  contributions.sort((a, b) => b[1] - a[1]);
  const [leading] = contributions[0];

  const namesOf = (ids: string[]) =>
    ids
      .map((id) => participants.find((p) => p.userId === id)?.username)
      .filter((n): n is string => !!n);

  if (leading === "watchlistOverlap" && entry.watchlistedBy.length > 0) {
    if (entry.watchlistedBy.length === participants.length && participants.length > 1) {
      return "Everyone here has this on their watchlist.";
    }
    const names = namesOf(entry.watchlistedBy);
    if (participants.length === 1) return "It's been sitting on your watchlist.";
    if (names.length === 1) return `${names[0]} has this on their watchlist.`;
    return `${names.slice(0, 2).join(" and ")} have this on their watchlist.`;
  }

  if (leading === "socialProof" && entry.followersWatched > 0) {
    return entry.followersWatched === 1
      ? "Someone you follow watched this."
      : `${entry.followersWatched} people you follow have watched this.`;
  }

  // The availability sentence is the honest fallback: it's the one thing we
  // can always state as fact, and it's what the room actually needs to know.
  const held = providers.find((p) => p.heldBy.length > 0) ?? providers[0];
  if (held) {
    const holderNames = namesOf(held.heldBy);
    const where =
      participants.length > 1 && holderNames.length === 1 && holderNames[0]
        ? `On ${holderNames[0]}'s ${held.name}`
        : `On ${held.name}`;
    return runtime ? `${where} · ${runtime} min` : where;
  }

  const genre = entry.genres[0];
  if (leading === "tasteFit" && genre) return `${genre} — the kind of thing you both go for.`;
  if (entry.voteAverage >= 7.5) return "Widely loved, and none of you have seen it.";
  return "Available to all of you right now.";
}

// ── Availability ────────────────────────────────────────────────────────────

type TmdbDetail = {
  runtime?: number;
  episode_run_time?: number[];
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: { id: number; name: string }[];
  "watch/providers"?: {
    results?: Record<
      string,
      {
        flatrate?: { provider_id: number; provider_name: string; logo_path?: string }[];
        free?: { provider_id: number; provider_name: string; logo_path?: string }[];
        ads?: { provider_id: number; provider_name: string; logo_path?: string }[];
      }
    >;
  };
};

/**
 * One TMDB call per candidate gets runtime *and* availability together —
 * appending watch/providers to the detail request rather than making two.
 * Only ever run over the top HYDRATE_LIMIT, never the whole pool.
 */
async function hydrate(
  entry: ScoredEntry,
  participants: TonightParticipant[],
  constraints: TonightConstraints,
): Promise<TonightCandidate | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  let detail: TmdbDetail;
  try {
    detail = await fetchTmdbJson<TmdbDetail>(
      `${TMDB_BASE}/${entry.itemType}/${entry.itemId}?api_key=${apiKey}&append_to_response=watch/providers`,
      { timeoutMs: 8000 },
    );
  } catch (err) {
    console.error(`tonight hydrate ${entry.itemType}/${entry.itemId}:`, err);
    return null;
  }

  const runtime =
    entry.itemType === "movie"
      ? (detail.runtime ?? null)
      : (detail.episode_run_time?.[0] ?? null);

  // Runtime is only known now for watchlist candidates — discover already
  // filtered its own results — so the constraint has to be re-applied here.
  if (constraints.maxRuntime && runtime && runtime > constraints.maxRuntime) return null;

  const regionData = detail["watch/providers"]?.results?.[constraints.region];
  const groupHasServices = participants.some((p) => p.providerIds.size > 0);

  const providers: TonightProvider[] = [];
  const seen = new Set<number>();
  // free and ads carry no subscription, so everyone in the room "holds" them.
  for (const [bucket, everyoneHolds] of [
    [regionData?.flatrate, false],
    [regionData?.free, true],
    [regionData?.ads, true],
  ] as const) {
    for (const p of bucket ?? []) {
      if (seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      providers.push({
        id: p.provider_id,
        name: p.provider_name,
        logoPath: p.logo_path ?? null,
        heldBy: everyoneHolds
          ? participants.map((x) => x.userId)
          : participants.filter((x) => x.providerIds.has(p.provider_id)).map((x) => x.userId),
      });
    }
  }

  if (providers.length === 0) return null;
  // Rule 1. When nobody has told us their services we can't enforce this, so
  // we fall back to "streams somewhere in the region" rather than returning an
  // empty screen to someone who skipped the picker.
  if (groupHasServices && !providers.some((p) => p.heldBy.length > 0)) return null;

  providers.sort((a, b) => b.heldBy.length - a.heldBy.length);

  const date = detail.release_date ?? detail.first_air_date ?? "";
  const genres = detail.genres?.map((g) => g.name) ?? entry.genres;
  const reasonEntry: ScoredEntry = { ...entry, genres };

  return {
    itemId: entry.itemId,
    itemType: entry.itemType,
    itemName: detail.title ?? detail.name ?? entry.itemName,
    imageUrl: detail.poster_path ?? entry.imageUrl,
    backdropUrl: detail.backdrop_path ?? entry.backdropUrl,
    year: date ? date.slice(0, 4) : entry.year,
    overview: detail.overview ?? entry.overview,
    genres,
    runtime,
    voteAverage: detail.vote_average ?? entry.voteAverage,
    providers,
    reason: buildReason(reasonEntry, participants, providers, runtime),
    episode: null,
    score: entry.score,
  };
}

// ── Episodes ────────────────────────────────────────────────────────────────

/** Below this, an evening is an episode-shaped evening, not a film-shaped one. */
const SHORT_EVENING_MINUTES = 75;

/**
 * Score an episode pick on the same 0–1 scale as a film, so the two compete
 * honestly for the single answer slot.
 *
 *   0.40  how much of the room is jointly in this show
 *   0.25  momentum — being eight episodes deep is a stronger pull than two
 *   0.20  taste fit, minimum across the room, same as films
 *   0.15  shape — an episode is the right answer for a short window
 *
 * A show two people are genuinely deep into lands around 0.8, which beats
 * almost any film. That's intended: when the room is mid-series with an hour
 * free, the next episode *is* the answer, and making them hunt for it is the
 * failure this whole feature exists to fix.
 */
function scoreEpisode(
  pick: EpisodePick,
  participants: TonightParticipant[],
  maxRuntime: number | null,
): number {
  const roomShare = pick.watchedBy.length / participants.length;
  const momentum = Math.min(pick.progress / 8, 1);

  const candidateVector = buildGenreVector([{ genres: pick.genres }]);
  let tasteFit = 1;
  for (const p of participants) {
    const sim = Object.keys(p.genreVector).length === 0
      ? 0.5
      : cosineSimilarity(p.genreVector, candidateVector);
    tasteFit = Math.min(tasteFit, sim);
  }

  const shortWindow = maxRuntime !== null && maxRuntime <= SHORT_EVENING_MINUTES ? 1 : 0;

  return 0.4 * roomShare + 0.25 * momentum + 0.2 * tasteFit + 0.15 * shortWindow;
}

/**
 * Turn an episode pick into a candidate.
 *
 * Providers are attached when TMDB knows them, but unlike a film this does
 * **not** gate on availability. Someone who is eight episodes into a series
 * has already demonstrated they can watch it — more convincingly than a
 * provider list can, since it misses owned copies, regional deals and
 * whatever they were using before. Refusing to surface their next episode
 * because TMDB has no row for it would be the tool overruling the evidence.
 */
async function episodeToCandidate(
  pick: EpisodePick,
  participants: TonightParticipant[],
  constraints: TonightConstraints,
  score: number,
): Promise<TonightCandidate> {
  const apiKey = process.env.TMDB_API_KEY;
  let providers: TonightProvider[] = [];

  if (apiKey) {
    try {
      const data = await fetchTmdbJson<{
        results?: Record<
          string,
          { flatrate?: { provider_id: number; provider_name: string; logo_path?: string }[] }
        >;
      }>(`${TMDB_BASE}/tv/${pick.showId}/watch/providers?api_key=${apiKey}`, { timeoutMs: 6000 });

      providers = (data.results?.[constraints.region]?.flatrate ?? []).map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logoPath: p.logo_path ?? null,
        heldBy: participants.filter((x) => x.providerIds.has(p.provider_id)).map((x) => x.userId),
      }));
      providers.sort((a, b) => b.heldBy.length - a.heldBy.length);
    } catch {
      // Availability is decoration here, not a gate — carry on without it.
    }
  }

  return {
    itemId: pick.showId,
    itemType: "tv",
    itemName: pick.showName,
    imageUrl: pick.posterPath,
    backdropUrl: pick.stillPath,
    year: null,
    overview: pick.overview,
    genres: pick.genres,
    runtime: pick.runtime,
    voteAverage: 0,
    providers,
    reason: buildEpisodeReason(pick, participants),
    episode: {
      seasonNumber: pick.seasonNumber,
      episodeNumber: pick.episodeNumber,
      name: pick.episodeName,
      stillPath: pick.stillPath,
    },
    score,
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

export type ResolveResult = {
  pick: TonightCandidate | null;
  alternates: TonightCandidate[];
};

/**
 * Resolve the room + constraints down to one answer.
 *
 * `rejected` is every item_id already voted out in this session — one veto
 * from anyone is enough, which is the same logic as scoring on the minimum.
 */
export async function resolveTonight(
  supabase: SupabaseClient,
  participants: TonightParticipant[],
  constraints: TonightConstraints,
  rejected: Set<string>,
): Promise<ResolveResult> {
  if (participants.length === 0) return { pick: null, alternates: [] };

  const [watchlist, discovered, episodePicks] = await Promise.all([
    watchlistPool(supabase, participants, constraints),
    discoverPool(participants, constraints),
    // Skip the work entirely when the room has asked for a film.
    constraints.mediaType === "movie"
      ? Promise.resolve([])
      : findEpisodePicks(supabase, participants, constraints.maxRuntime, rejected),
  ]);

  // Watchlist entries win ties on identity: they carry the watchlistedBy
  // attribution that discover results can't.
  const pool = new Map<string, PoolEntry>();
  for (const entry of [...discovered, ...watchlist]) {
    const existing = pool.get(entry.itemId);
    if (existing) {
      // Keep discover's richer metadata, keep the watchlist's attribution.
      existing.watchlistedBy = [...new Set([...existing.watchlistedBy, ...entry.watchlistedBy])];
      if (!existing.itemName) existing.itemName = entry.itemName;
      continue;
    }
    pool.set(entry.itemId, { ...entry });
  }

  const eligible = [...pool.values()].filter((entry) => {
    if (rejected.has(entry.itemId)) return false;
    if (!entry.itemName) return false;
    for (const p of participants) {
      const status = p.statusByItem.get(entry.itemId);
      if (status === "dropped") return false;
      if (status === "watched" && !constraints.allowRewatch) return false;
    }
    return true;
  });

  if (eligible.length === 0) return { pick: null, alternates: [] };

  const proof = await socialProofCounts(supabase, participants, eligible.map((e) => e.itemId));

  const scored = eligible
    .map((entry) => scoreEntry(entry, participants, proof.get(entry.itemId) ?? 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, HYDRATE_LIMIT);

  const hydrated = (
    await Promise.all(scored.map((entry) => hydrate(entry, participants, constraints)))
  ).filter((c): c is TonightCandidate => c !== null);

  // Episodes are built alongside films and then ranked against them on the
  // same scale, rather than being appended after — the single answer slot has
  // to be winnable by whichever is genuinely the better call tonight.
  const episodes = await Promise.all(
    episodePicks
      .map((pick) => ({ pick, score: scoreEpisode(pick, participants, constraints.maxRuntime) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ pick, score }) => episodeToCandidate(pick, participants, constraints, score)),
  );

  const all = [...hydrated, ...episodes].sort((a, b) => b.score - a.score);

  if (all.length === 0) return { pick: null, alternates: [] };

  return {
    pick: all[0],
    alternates: all.slice(1, 1 + ALTERNATE_COUNT),
  };
}

/** Shared parsing so POST /api/tonight and re-resolves agree on defaults. */
export function normalizeConstraints(
  raw: Record<string, unknown>,
  fallbackRegion: string,
): TonightConstraints {
  const rawRegion = typeof raw.region === "string" ? raw.region.trim().toUpperCase() : "";
  const maxRuntime = Number(raw.maxRuntime);
  const mediaType = raw.mediaType === "movie" || raw.mediaType === "tv" ? raw.mediaType : "any";

  return {
    region: /^[A-Z]{2}$/.test(rawRegion) ? rawRegion : fallbackRegion,
    maxRuntime: Number.isFinite(maxRuntime) && maxRuntime > 0 ? Math.min(maxRuntime, 600) : null,
    mediaType,
    moods: Array.isArray(raw.moods)
      ? (raw.moods as unknown[]).map(String).filter((m) => m in MOODS).slice(0, 4)
      : [],
    allowRewatch: raw.allowRewatch === true,
  };
}
