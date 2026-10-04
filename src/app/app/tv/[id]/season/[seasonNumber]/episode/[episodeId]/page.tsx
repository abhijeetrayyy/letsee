import React from "react";
import Link from "@components/ui/AppLink";
import { notFound, unstable_rethrow } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import MediaGallery from "@components/detail/MediaGallery";
import VideoShelf from "@components/detail/VideoShelf";
import MarkEpisodeWatched from "@components/tv/MarkEpisodeWatched";
import EpisodeSpoilerGate from "@components/tv/EpisodeSpoilerGate";
import EpisodePeople from "@components/tv/EpisodePeople";
import Fold from "@components/ds/Fold";
import Avatar from "@components/ui/Avatar";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { fetchTmdb } from "@/utils/tmdbClient";
import TitleTalk from "@components/takes/TitleTalk";
import { episodePath, parseRouteId, personPath, seasonPath, titlePath } from "@/utils/urls";
import { formatLongDate, parseTmdbDate } from "@/utils/person/dates";
import type { Metadata } from "next";
import JsonLd from "@components/seo/JsonLd";
import { tvEpisodeLd, breadcrumbLd } from "@/utils/structuredData";

interface EpisodeDetails {
  id: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  overview: string;
  still_path: string | null;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  guest_stars: {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }[];
  crew: {
    id: number;
    name: string;
    job: string;
    profile_path: string | null;
  }[];
  images: { stills: { file_path: string }[] };
  videos: { key: string; name: string; type: string; site: string; official?: boolean; published_at?: string }[];
}

interface PageProps {
  params: Promise<{ id: string; seasonNumber: string; episodeId: string }>;
}


/**
 * Six hours, up from five minutes, and the route below is cached for the same
 * window — deliberately the same number, because Next takes the *minimum* of a
 * route's `revalidate` and every fetch inside its render. Leaving this at 300
 * while setting `revalidate = 21600` would have produced a page that looks
 * cached in the config and is re-rendered every five minutes in production,
 * which is the exact trap commit 6d539ed had to measure its way out of on the
 * movie and series pages.
 *
 * An aired episode's TMDB record — its name, overview, still, runtime, guest
 * cast — does not change again. Six hours is conservative for it; it is chosen
 * to match `TMDB_REVALIDATE_SEC` in `tmdbTvShow.ts`, which this render also
 * calls into for the series name and season length, and which is therefore the
 * real ceiling regardless of what is written here.
 */
const EPISODE_REVALIDATE_SEC = 86400;

/**
 * ── Cached, now that nothing here reads a session ─────────────────────────
 *
 * See the note in the component below: this page opened a session and read the
 * viewer's own episode rating into a variable that nothing rendered. With that
 * gone, every byte this route produces is TMDB data that is identical for
 * every visitor, so there is no longer a reason to rebuild it per request.
 *
 * `generateStaticParams` returning `[]` is not optional next to `revalidate`.
 * On a `[param]` route without it, Next treats the route as fully dynamic and
 * emits `no-store` no matter what `revalidate` says — R3 in the incident
 * document, and the reason the first attempt at that fix appeared to do
 * nothing. Empty means "prerender none of them at build time, and cache each
 * one the first time somebody asks for it".
 */
/**
 * A day, up from six hours.
 *
 * Six hours meant four ISR write units per page per day for anything still
 * being visited — and season and episode pages are the deepest, most numerous
 * routes in the app, so they are the ones where a short window costs the most.
 * A newly aired episode showing up a few hours later than it might have is not
 * a defect anyone will report.
 */
export const revalidate = 86400;

export async function generateStaticParams() {
  return [];
}

const fetchEpisodeData = async (
  id: string,
  seasonNumber: string,
  episodeId: string,
) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDb API key is missing");
  }

  const url = `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}/episode/${episodeId}?api_key=${apiKey}&append_to_response=images,videos`;
  const response = await fetchTmdb(url, { revalidate: EPISODE_REVALIDATE_SEC });

  if (!response.ok) {
    if (response.status === 404) notFound();
    throw new Error(`Failed to fetch episode data: ${response.status}`);
  }

  const data = await response.json();

  const seriesData = await getTvShowWithSeasons(id);
  const seriesName = (seriesData?.name as string) ?? "Series";
  const seasons = (seriesData?.seasons as any[]) || [];
  const currentSeasonData = seasons.find(
    (s) => s.season_number === parseInt(seasonNumber, 10),
  );
  const episodeCount = currentSeasonData?.episode_count || 0;
  const n = parseInt(seasonNumber, 10);
  // The season after this one with episodes in it, so the last episode of a
  // season can point at the first of the next.
  const nextSeason = seasons
    .filter((s) => s.season_number > n && (s.episode_count ?? 0) > 0)
    .sort((a, b) => a.season_number - b.season_number)[0]?.season_number ?? null;
  const prevSeason = seasons
    .filter((s) => s.season_number > 0 && s.season_number < n && (s.episode_count ?? 0) > 0)
    .sort((a, b) => b.season_number - a.season_number)[0] ?? null;

  return {
    seriesName,
    seasonNumber: n,
    episodeCount,
    nextSeason: n > 0 ? nextSeason : null,
    prevSeason: n > 0 && prevSeason ? { s: prevSeason.season_number as number, last: prevSeason.episode_count as number } : null,
    episode: {
      id: data.id,
      episode_number: data.episode_number,
      name: data.name,
      air_date: data.air_date,
      overview: data.overview,
      still_path: data.still_path,
      runtime: data.runtime,
      vote_average: data.vote_average,
      vote_count: data.vote_count,
      guest_stars: (data.guest_stars || []) as EpisodeDetails["guest_stars"],
      crew: (data.crew || []) as EpisodeDetails["crew"],
      images: data.images || { stills: [] },
      videos: data.videos?.results || [],
    },
  };
};


/**
 * An episode page is the most specific thing this app has, and it was the least
 * described: every one of them inherited the site title. A person searching an
 * episode by name got nothing here, which is the search a TV tracker should win.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: rawId, seasonNumber, episodeId } = await params;
  const id = parseRouteId(rawId);
  if (!id) return { title: "Episode" };

  try {
    // fetchTmdb is revalidate-cached, so this rides along on the page's own fetch.
    const { seriesName, episode } = await fetchEpisodeData(id, seasonNumber, episodeId);
    const seasonNum = parseInt(seasonNumber, 10);
    const code = `S${String(seasonNum).padStart(2, "0")}E${String(episode.episode_number).padStart(2, "0")}`;
    const title = `${seriesName} ${code}: ${episode.name}`;

    const description =
      (episode.overview && episode.overview.trim().slice(0, 200)) ||
      `${episode.name} — ${code} of ${seriesName}${
        episode.air_date ? `, first aired ${episode.air_date}` : ""
      }. Rate it, log it, and see what everyone else thought.`;

    const canonical = episodePath(id, seasonNum, episode.episode_number, seriesName);
    const image = episode.still_path
      ? `https://image.tmdb.org/t/p/w780${episode.still_path}`
      : null;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        type: "video.episode",
        title,
        description,
        url: canonical,
        images: image ? [{ url: image, width: 780, height: 439, alt: title }] : [],
      },
      twitter: { card: "summary_large_image", title, description, images: image ? [image] : [] },
    };
  } catch {
    return { title: "Episode" };
  }
}

const EpisodePage = async ({ params }: PageProps) => {
  const rawId = (await params).id;
  const id = parseRouteId(rawId);
  const seasonNumber = (await params).seasonNumber;
  const episodeId = (await params).episodeId;

  if (!id) {
    return notFound();
  }

  /**
   * ── What was removed here, and why it mattered more than it looked ───────
   *
   * This used to open a session (`auth.getUser()` — a network round trip to
   * Supabase) and then, for a signed-in visitor, read their own score and note
   * for this episode out of `episode_ratings`. The result was assigned to a
   * local called `userRating`.
   *
   * Nothing read `userRating`. Not one line. The variable was assigned and
   * dropped, and the rating widget on this page gets its own state from the
   * client.
   *
   * Two round trips per render for a value nobody used is bad on its own. The
   * expensive part is what the *first* of them did to the page: reading a
   * session forces a dynamic render, so this route emitted `no-store` and
   * rebuilt itself from scratch on every hit. Episode pages are deliberately
   * left out of the sitemap because there are tens of thousands of them — but
   * they are linked from every season page, so a crawler walks into all of
   * them anyway. The most numerous page on the site was uncacheable in order
   * to compute a dead variable.
   */
  const episodeRes = await fetchEpisodeData(id, seasonNumber, episodeId).catch((e) => {
    // `notFound()` inside the fetch throws; let Next turn it into a 404.
    unstable_rethrow(e);
    return { error: e };
  });

  if ((episodeRes as any).error) {
    return (
      <div className="mx-auto flex w-full max-w-read flex-col items-start gap-4 px-4 py-16">
        <h1 className="text-2xl text-ink-0">This episode didn&apos;t load.</h1>
        <p className="text-sm text-ink-400">TMDB didn&apos;t answer. Try again in a moment.</p>
        <Link href={seasonPath(id, seasonNumber)} className="text-sm font-medium text-ink-0 underline decoration-line-input underline-offset-4">
          Back to the season
        </Link>
      </div>
    );
  }

  const data = episodeRes as Awaited<ReturnType<typeof fetchEpisodeData>>;
  const { seriesName, seasonNumber: seasonNum, episode, episodeCount, nextSeason, prevSeason } = data;
  const n = episode.episode_number;
  const code = `S${String(seasonNum).padStart(2, "0")} · E${String(n).padStart(2, "0")}`;
  const aired = parseTmdbDate(episode.air_date);
  const stamp = [code, episode.runtime ? `${episode.runtime} min` : null, aired ? formatLongDate(aired) : null].filter(Boolean).join(" · ");
  const prev = n > 1 ? { s: seasonNum, e: n - 1 } : prevSeason?.last ? { s: prevSeason.s, e: prevSeason.last } : null;
  const next = episodeCount && n < episodeCount ? { s: seasonNum, e: n + 1 } : nextSeason != null ? { s: nextSeason, e: 1 } : null;
  const short = (ep: { s: number; e: number }) => (ep.s === seasonNum ? `E${String(ep.e).padStart(2, "0")}` : `S${String(ep.s).padStart(2, "0")} E${String(ep.e).padStart(2, "0")}`);
  const gate = { showId: id, seasonNumber: seasonNum, episodeNumber: n };
  // Who made it: director and writer up top, everyone else in the fold.
  const credit = (job: string) => [...new Set(episode.crew.filter((c) => c.job === job).map((c) => c.name))];
  const byline = [credit("Director").length ? `Directed by ${credit("Director").join(", ")}` : null, credit("Writer").length ? `Written by ${credit("Writer").join(", ")}` : null].filter(Boolean);

  return (
    <>
      <JsonLd
        data={[
          tvEpisodeLd({
            showId: id,
            showName: seriesName,
            seasonNumber: seasonNum,
            episodeNumber: n,
            name: episode.name,
            overview: episode.overview,
            stillPath: episode.still_path,
            airDate: episode.air_date,
            runtime: episode.runtime,
          }),
          breadcrumbLd([
            { name: "Series", path: "/app/search?browse=1&type=tv" },
            { name: seriesName, path: titlePath("tv", id, seriesName) },
            { name: `Season ${seasonNum}`, path: seasonPath(id, seasonNum, seriesName) },
            { name: episode.name, path: episodePath(id, seasonNum, n, seriesName) },
          ]),
        ]}
      />
      <div className="mx-auto flex w-full max-w-read flex-col gap-8 px-4 pt-6 sm:pt-10">
        <header className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 text-sm text-ink-400">
            <Link href={titlePath("tv", id, seriesName)} className="hover:text-ink-0">
              {seriesName}
            </Link>
            <span aria-hidden className="text-ink-600">/</span>
            <Link href={seasonPath(id, seasonNum, seriesName)} className="hover:text-ink-0">
              {seasonNum === 0 ? "Specials" : `Season ${seasonNum}`}
            </Link>
          </nav>
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-ink-500">{stamp}</p>
            <h1 className="mt-2 text-3xl text-ink-0 sm:text-4xl">{episode.name}</h1>
            {byline.length > 0 && <p className="mt-2 text-sm text-ink-400">{byline.join(" · ")}</p>}
          </div>
          <MarkEpisodeWatched {...gate} />
        </header>

        {/* One gate for the page. It names what it holds; the rest of the
            gated blocks stay out of the way until the episode is watched or
            revealed, and are not in the DOM until then. */}
        <EpisodeSpoilerGate {...gate} label="the overview" primary holds={["the overview", "the stills", "the guest stars", "the thread"]}>
          <div className="flex flex-col gap-4">
            {episode.still_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://image.tmdb.org/t/p/w780${episode.still_path}`} alt="" className="aspect-video w-full rounded-card object-cover ring-1 ring-inset ring-line" />
            )}
            <p className="text-base leading-relaxed text-ink-300">{episode.overview || "TMDB has no overview for this episode."}</p>
          </div>
        </EpisodeSpoilerGate>

        <EpisodePeople {...gate} />

        {/* The moment: your rating and words for the episode, then everyone
            else's. TV Time's ritual — the thread opens once you've marked it. */}
        <EpisodeSpoilerGate {...gate} label="the thread">
          <TitleTalk itemId={id} itemType="tv" scope="episode" seasonNumber={seasonNum} episodeNumber={n} itemName={episode.name} />
        </EpisodeSpoilerGate>

        <div className="flex flex-col gap-3">
          {episode.guest_stars.length > 0 && (
            <EpisodeSpoilerGate {...gate} label="the guest stars">
              <Fold title="Guest stars" count={episode.guest_stars.length}>
                <ul className="flex flex-col">
                  {episode.guest_stars.map((p) => (
                    <li key={`${p.id}-${p.character}`}>
                      <Link href={personPath(p.id, p.name)} className="flex min-h-14 items-center gap-3 border-b border-line py-2 last:border-b-0 hover:bg-hover">
                        <Avatar src={p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : null} name={p.name} size={40} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink-0">{p.name}</span>
                          {p.character && <span className="block truncate text-sm text-ink-500">{p.character}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Fold>
            </EpisodeSpoilerGate>
          )}
          {episode.crew.length > 0 && (
            <Fold title="Crew" count={episode.crew.length}>
              <ul className="flex flex-col">
                {episode.crew.map((c) => (
                  <li key={`${c.id}-${c.job}`}>
                    <Link href={personPath(c.id, c.name)} className="flex min-h-11 items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0 hover:bg-hover">
                      <span className="truncate text-sm font-medium text-ink-0">{c.name}</span>
                      <span className="shrink-0 text-sm text-ink-500">{c.job}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Fold>
          )}
          {episode.images.stills.length > 1 && (
            <EpisodeSpoilerGate {...gate} label="the stills">
              <Fold title="Stills" count={episode.images.stills.length}>
                <MediaGallery backdrops={episode.images.stills} title={`${seriesName}: ${episode.name}`} />
              </Fold>
            </EpisodeSpoilerGate>
          )}
          {episode.videos.length > 0 && (
            <Fold title="Clips" count={episode.videos.length}>
              <VideoShelf videos={episode.videos} />
            </Fold>
          )}
        </div>

        {/* Previous and next, pinned above the tab bar while you read. */}
        {(prev || next) && (
          <nav aria-label="Episodes" className="pin-above-tabs -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur">
            {prev ? (
              <Link href={episodePath(id, prev.s, prev.e, seriesName)} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
                <ArrowLeft className="size-4" aria-hidden />
                {short(prev)}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={episodePath(id, next.s, next.e, seriesName)} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover">
                {short(next)}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
};

export default EpisodePage;
