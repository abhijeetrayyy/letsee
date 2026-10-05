import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { tmdbConfigured } from "@/utils/tmdbClient";
import { guard } from "@/lib/limits/guard";

/**
 * One person's work, for a title page's "More from…" and "More with…" rails
 * (components/detail/PersonWork).
 *
 * The cost is per person, not per title: every film Christopher Nolan made
 * asks for the same `/api/person-work?id=525`, so the CDN answers all of them
 * from one response for a day (and serves it stale for a week while it
 * refreshes). One
 * TMDB call — the person with `combined_credits` appended — and only when a
 * reader scrolls near the rail (the component waits until it's in view).
 *
 * Trimmed here, so a page receives twenty or forty small rows rather than an
 * actor's 400-credit filmography.
 */
type Credit = {
  id?: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
  vote_count?: number;
  job?: string;
  department?: string;
  character?: string;
  episode_count?: number;
  /** Billing position in a film's cast: 0 is the lead. */
  order?: number;
  genre_ids?: number[];
};

type Person = {
  id?: number;
  name?: string;
  profile_path?: string | null;
  known_for_department?: string;
  combined_credits?: { cast?: Credit[]; crew?: Credit[] };
};

export type WorkItem = {
  id: number;
  type: "movie" | "tv";
  title: string;
  posterPath: string | null;
  year: string | null;
  /** Not out yet. */
  upcoming: boolean;
};

export type PersonWorkResponse = {
  person: { id: number; name: string; profilePath: string | null; department: string | null };
  /** Films they directed, newest first. */
  directed: WorkItem[];
  /** Series they created (or ran), newest first. */
  created: WorkItem[];
  /** What they're best known for on screen, most popular first. */
  acted: WorkItem[];
};

const TALK_SHOWS = new Set([10767, 10763]); // talk, news: an appearance, not a role

function toItem(c: Credit, today: string): WorkItem | null {
  if (typeof c.id !== "number" || (c.media_type !== "movie" && c.media_type !== "tv")) return null;
  const title = (c.title ?? c.name ?? "").trim();
  if (!title) return null;
  const date = (c.release_date ?? c.first_air_date ?? "").slice(0, 10);
  return {
    id: c.id,
    type: c.media_type,
    title,
    posterPath: c.poster_path ?? null,
    year: date ? date.slice(0, 4) : null,
    upcoming: !date || date > today,
  };
}

function unique(items: (WorkItem | null)[]): WorkItem[] {
  const seen = new Set<string>();
  const out: WorkItem[] = [];
  for (const it of items) {
    if (!it) continue;
    const key = `${it.type}:${it.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

const newestFirst = (a: WorkItem, b: WorkItem) => (b.year ?? "9999").localeCompare(a.year ?? "9999");

export async function GET(request: NextRequest) {
  const limited = await guard("tmdb", request);
  if (limited) return limited;
  if (!tmdbConfigured()) return jsonError("TMDB_READ_TOKEN is missing on the server.", 500);

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return jsonError("Missing or invalid person id.", 400);

  let data: Person;
  try {
    // The edge cache below is the cache: TMDB hears from this route once per
    // person per day per region, whoever is asking.
    data = await serverFetchJson<Person>(`https://api.themoviedb.org/3/person/${id}?append_to_response=combined_credits`, { timeoutMs: 8000 });
  } catch (err) {
    return jsonError((err as Error).message ?? "Failed to fetch that person.", 502);
  }

  const today = new Date().toISOString().slice(0, 10);
  const crew = data.combined_credits?.crew ?? [];
  const cast = data.combined_credits?.cast ?? [];

  const directed = unique(crew.filter((c) => c.job === "Director" && c.media_type === "movie").map((c) => toItem(c, today)))
    .sort(newestFirst)
    .slice(0, 40);
  const created = unique(
    crew.filter((c) => c.media_type === "tv" && (c.job === "Creator" || c.job === "Showrunner")).map((c) => toItem(c, today)),
  )
    .sort(newestFirst)
    .slice(0, 20);
  // Roles, not appearances: billed in a film's top eight, or in at least four
  // episodes of a series. A voice in one episode or a cameo in a blockbuster
  // is popular, and isn't what "more with" them means.
  const isRole = (c: Credit) =>
    c.media_type === "movie" ? (c.order ?? 99) <= 8 : (c.episode_count ?? 0) >= 4 && !(c.genre_ids ?? []).some((g) => TALK_SHOWS.has(g));
  const acted = unique(
    cast
      .filter((c) => (c.vote_count ?? 0) >= 20 && isRole(c))
      .sort((a, b) => (b.popularity ?? 0) * Math.log10((b.vote_count ?? 0) + 10) - (a.popularity ?? 0) * Math.log10((a.vote_count ?? 0) + 10))
      .map((c) => toItem(c, today)),
  ).slice(0, 20);

  const body: PersonWorkResponse = {
    person: { id: Number(id), name: data.name ?? "", profilePath: data.profile_path ?? null, department: data.known_for_department ?? null },
    directed,
    created,
    acted,
  };
  // A person's work changes slowly: shared at the edge by everyone who asks.
  return jsonSuccess(body, { maxAge: 86400, staleWhileRevalidate: 604800 });
}
