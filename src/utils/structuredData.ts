import { absoluteUrl } from "@/utils/siteUrl";
import { episodePath, personPath, seasonPath, titlePath } from "@/utils/urls";

/**
 * schema.org JSON-LD.
 *
 * There was none anywhere, which is the difference between a page a search
 * engine can read and one it can *understand*. A film page without it is a wall
 * of text that happens to mention a year; with it, the year is a release date,
 * the names are a cast, and the number out of ten is an aggregate rating —
 * which is what earns the star row in a result and the panel beside it.
 *
 * Everything here is derived from what the page already renders. Structured
 * data that claims more than the visible page is the one thing Google
 * penalises for, so if a value is not on screen it is not emitted: no rating
 * unless the rating is shown, no review count unless the reviews are there.
 *
 * `undefined` is dropped rather than serialised, because `"director": null` in
 * a graph is worse than an absent key.
 */

type Json = Record<string, unknown>;

/** Drop empty values so the emitted graph asserts only what the page shows. */
function compact(obj: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

const img = (path?: string | null, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined;

export function organisationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LetSee",
    url: absoluteUrl("/"),
    description:
      "Track what you watch, write about it, and see what the people whose taste you trust are watching.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/app/search")}/{search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** A trail a crawler can follow, and the crumbs a result page renders. */
export function breadcrumbLd(trail: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

type TmdbPerson = { id: number; name: string };

/** An untyped TMDB payload. Read every field defensively. */
type TmdbLike = Record<string, any>;

export function movieLd(movie: TmdbLike): Json {
  const directors = ((movie.credits?.crew ?? []) as (TmdbPerson & { job?: string })[]).filter((c) => c.job === "Director");
  const cast = ((movie.credits?.cast ?? []) as TmdbPerson[]).slice(0, 8);
  return compact({
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    url: absoluteUrl(titlePath("movie", movie.id, movie.title)),
    description: movie.overview || undefined,
    image: img(movie.poster_path),
    datePublished: movie.release_date || undefined,
    // ISO 8601 duration. "PT139M" is what a crawler expects; "139 min" is not.
    duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
    genre: (movie.genres ?? []).map((g: { name: string }) => g.name),
    director: directors.map((d) => ({
      "@type": "Person",
      name: d.name,
      url: absoluteUrl(personPath(d.id, d.name)),
    })),
    actor: cast.map((c) => ({
      "@type": "Person",
      name: c.name,
      url: absoluteUrl(personPath(c.id, c.name)),
    })),
    aggregateRating:
      movie.vote_average && movie.vote_count
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(movie.vote_average.toFixed(1)),
            ratingCount: movie.vote_count,
            bestRating: 10,
            worstRating: 0,
          }
        : undefined,
  });
}

export function tvSeriesLd(show: TmdbLike): Json {
  return compact({
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.name,
    url: absoluteUrl(titlePath("tv", show.id, show.name)),
    description: show.overview || undefined,
    image: img(show.poster_path),
    startDate: show.first_air_date || undefined,
    endDate: show.last_air_date || undefined,
    numberOfSeasons: show.number_of_seasons || undefined,
    numberOfEpisodes: show.number_of_episodes || undefined,
    genre: (show.genres ?? []).map((g: { name: string }) => g.name),
    creator: ((show.created_by ?? []) as TmdbPerson[]).map((c) => ({
      "@type": "Person",
      name: c.name,
      url: absoluteUrl(personPath(c.id, c.name)),
    })),
    actor: ((show.credits?.cast ?? []) as TmdbPerson[]).slice(0, 8).map((c) => ({
      "@type": "Person",
      name: c.name,
      url: absoluteUrl(personPath(c.id, c.name)),
    })),
    aggregateRating:
      show.vote_average && show.vote_count
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(show.vote_average.toFixed(1)),
            ratingCount: show.vote_count,
            bestRating: 10,
            worstRating: 0,
          }
        : undefined,
  });
}

/**
 * The TMDB payloads these read arrive as untyped JSON, so the inputs are
 * permissive and every field is read defensively. Demanding an exact shape here
 * would only move the cast to each call site, which is the same trust with more
 * ceremony.
 */
/**
 * A season, tied to the series it belongs to.
 *
 * `partOfSeries` is the whole point: without it a season page is an orphan that
 * happens to mention a show name, and with it a crawler can place it in the
 * series it belongs to and surface it under that name.
 */
export function tvSeasonLd(season: {
  showId: string | number;
  showName: string;
  seasonNumber: number;
  name?: string | null;
  overview?: string | null;
  posterPath?: string | null;
  airDate?: string | null;
  episodeCount?: number | null;
}): Json {
  return compact({
    "@context": "https://schema.org",
    "@type": "TVSeason",
    name: season.name || `Season ${season.seasonNumber}`,
    url: absoluteUrl(seasonPath(season.showId, season.seasonNumber, season.showName)),
    seasonNumber: season.seasonNumber,
    description: season.overview || undefined,
    image: img(season.posterPath),
    datePublished: season.airDate || undefined,
    numberOfEpisodes: season.episodeCount || undefined,
    partOfSeries: {
      "@type": "TVSeries",
      name: season.showName,
      url: absoluteUrl(titlePath("tv", season.showId, season.showName)),
    },
  });
}

/** One episode, tied to both its season and its series. */
export function tvEpisodeLd(ep: {
  showId: string | number;
  showName: string;
  seasonNumber: number;
  episodeNumber: number;
  name?: string | null;
  overview?: string | null;
  stillPath?: string | null;
  airDate?: string | null;
  runtime?: number | null;
}): Json {
  return compact({
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: ep.name || `Episode ${ep.episodeNumber}`,
    url: absoluteUrl(episodePath(ep.showId, ep.seasonNumber, ep.episodeNumber, ep.showName)),
    episodeNumber: ep.episodeNumber,
    description: ep.overview || undefined,
    image: img(ep.stillPath, "w780"),
    datePublished: ep.airDate || undefined,
    timeRequired: ep.runtime ? `PT${ep.runtime}M` : undefined,
    partOfSeason: {
      "@type": "TVSeason",
      seasonNumber: ep.seasonNumber,
      url: absoluteUrl(seasonPath(ep.showId, ep.seasonNumber, ep.showName)),
    },
    partOfSeries: {
      "@type": "TVSeries",
      name: ep.showName,
      url: absoluteUrl(titlePath("tv", ep.showId, ep.showName)),
    },
  });
}

export function personLd(person: TmdbLike): Json {
  return compact({
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    url: absoluteUrl(personPath(person.id, person.name)),
    description: person.biography || undefined,
    image: img(person.profile_path, "w342"),
    birthDate: person.birthday || undefined,
    deathDate: person.deathday || undefined,
    birthPlace: person.place_of_birth || undefined,
    jobTitle: person.known_for_department || undefined,
  });
}

/**
 * One person's writing about one title.
 *
 * `itemReviewed` is what ties a review to the film rather than leaving it as
 * loose text, and it is why a review page can surface under the film's name.
 */
export function reviewLd(review: {
  body: string;
  authorName: string;
  authorUrl?: string;
  datePublished?: string | null;
  score?: number | null;
  itemName: string;
  itemType: "movie" | "tv";
  itemId: string | number;
  itemImage?: string | null;
  url: string;
}): Json {
  return compact({
    "@context": "https://schema.org",
    "@type": "Review",
    url: absoluteUrl(review.url),
    reviewBody: review.body,
    datePublished: review.datePublished || undefined,
    author: compact({
      "@type": "Person",
      name: review.authorName,
      url: review.authorUrl ? absoluteUrl(review.authorUrl) : undefined,
    }),
    itemReviewed: compact({
      "@type": review.itemType === "tv" ? "TVSeries" : "Movie",
      name: review.itemName,
      url: absoluteUrl(titlePath(review.itemType, review.itemId, review.itemName)),
      image: img(review.itemImage),
    }),
    reviewRating:
      review.score != null
        ? {
            "@type": "Rating",
            ratingValue: review.score,
            bestRating: 10,
            worstRating: 1,
          }
        : undefined,
  });
}

export function profileLd(user: {
  username: string;
  about?: string | null;
  tagline?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
}): Json {
  return compact({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: user.createdAt || undefined,
    mainEntity: compact({
      "@type": "Person",
      name: user.username,
      alternateName: `@${user.username}`,
      url: absoluteUrl(`/app/profile/${encodeURIComponent(user.username)}`),
      description: user.tagline || user.about || undefined,
      image: user.avatarUrl || undefined,
    }),
  });
}

/** A named list of titles — what a curated list page actually is. */
export function itemListLd(list: {
  name: string;
  description?: string | null;
  url: string;
  items: { itemId: string | number; itemType: string; name: string }[];
}): Json {
  return compact({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: list.name,
    description: list.description || undefined,
    url: absoluteUrl(list.url),
    numberOfItems: list.items.length,
    itemListElement: list.items.slice(0, 100).map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(titlePath(item.itemType, item.itemId, item.name)),
      name: item.name,
    })),
  });
}
