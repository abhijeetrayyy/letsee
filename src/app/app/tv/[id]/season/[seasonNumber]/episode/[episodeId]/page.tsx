import React from "react";
import Link from "@components/ui/AppLink";
import { notFound } from "next/navigation";
import { FaChevronRight, FaChevronLeft, FaStar } from "react-icons/fa";
import ImageViewEpisode from "@components/clientComponent/imageViewEpisode";
import VideoEpisode from "@components/clientComponent/videoEpisode";
import MarkEpisodeWatched from "@components/tv/MarkEpisodeWatched";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { fetchTmdb } from "@/utils/tmdbClient";
import TitleTalk from "@components/takes/TitleTalk";
import { ArrowLeft, Clock, Calendar, Users, Clapperboard, Star } from "lucide-react";
import { episodePath, parseRouteId, personPath, seasonPath, titlePath } from "@/utils/urls";
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
  videos: { key: string; type: string; site: string }[];
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
const EPISODE_REVALIDATE_SEC = 21600;

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

  return {
    seriesName,
    seasonNumber: parseInt(seasonNumber, 10),
    episodeCount,
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
      guest_stars: data.guest_stars || [],
      crew: data.crew || [],
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
  const episodeRes = await fetchEpisodeData(id, seasonNumber, episodeId).catch(
    (e) => ({ error: e }),
  );

  if ((episodeRes as any).error) {
    const error = (episodeRes as any).error;
    return (
      <div className="min-h-screen bg-surface-950 text-white flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <p className="text-red-400 text-lg font-semibold">Error loading episode</p>
          <p className="text-surface-400 text-sm mt-2">{(error as Error).message}</p>
          <Link href={seasonPath(id, seasonNumber)} className="btn-primary mt-4 inline-block">
            Back to Season
          </Link>
        </div>
      </div>
    );
  }

  const data = episodeRes as Awaited<ReturnType<typeof fetchEpisodeData>>;
  const { seriesName, seasonNumber: seasonNum, episode } = data;
  const epNum = episode.episode_number.toString().padStart(2, "0");

  return (
    <>
      <JsonLd
        data={[
          tvEpisodeLd({
            showId: id,
            showName: seriesName,
            seasonNumber: seasonNum,
            episodeNumber: episode.episode_number,
            name: episode.name,
            overview: episode.overview,
            stillPath: episode.still_path,
            airDate: episode.air_date,
            runtime: episode.runtime,
          }),
          breadcrumbLd([
            { name: "TV", path: "/app/browse?type=tv" },
            { name: seriesName, path: titlePath("tv", id, seriesName) },
            { name: `Season ${seasonNum}`, path: seasonPath(id, seasonNum, seriesName) },
            {
              name: episode.name,
              path: episodePath(id, seasonNum, episode.episode_number, seriesName),
            },
          ]),
        ]}
      />
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {episode.still_path ? (
          <>
            <img loading="lazy" decoding="async" src={`https://image.tmdb.org/t/p/w1280${episode.still_path}`} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/80 to-surface-950/30" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-surface-950" />
        )}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-2 text-sm text-surface-500 mb-6">
            <Link href={titlePath("tv", id, seriesName)} className="hover:text-brand-400 transition-colors">
              {seriesName}
            </Link>
            <FaChevronRight className="w-3 h-3" />
            <Link href={seasonPath(id, seasonNum, seriesName)} className="hover:text-brand-400 transition-colors">
              Season {seasonNumber}
            </Link>
            <FaChevronRight className="w-3 h-3" />
            <span className="text-surface-300">Episode {epNum}</span>
          </nav>

          {/* Episode Title + Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="badge-brand">S{seasonNum} E{epNum}</span>
            {episode.air_date && (
              <span className="pill-glass text-sm flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(episode.air_date).toLocaleDateString()}
              </span>
            )}
            {episode.runtime && (
              <span className="pill-glass text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {episode.runtime}m
              </span>
            )}
            {episode.vote_average > 0 && (
              <span className="pill-glass text-sm flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
                {episode.vote_average.toFixed(1)}
                <span className="text-surface-600 text-xs">({episode.vote_count})</span>
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white max-w-3xl">
            {episode.name}
          </h1>

          <p className="text-base text-surface-400 mt-4 max-w-3xl leading-relaxed">
            {episode.overview || "No overview available."}
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <MarkEpisodeWatched
              showId={id}
              seasonNumber={seasonNum}
              episodeNumber={episode.episode_number}
            />
          </div>

          {/* Episode Navigation */}
          <div className="flex items-center gap-3 mt-6">
            {episode.episode_number > 1 ? (
              <Link
                href={episodePath(id, seasonNum, episode.episode_number - 1, seriesName)}
                className="btn-secondary text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </Link>
            ) : <div />}
            {data?.episodeCount && episode.episode_number < data.episodeCount && (
              <Link
                href={episodePath(id, seasonNum, episode.episode_number + 1, seriesName)}
                className="btn-primary text-sm"
              >
                Next <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* The rating used to sit beside the watched button and the note far
            below it — the same split D1 exists to remove. */}
        {/* One composer and one thread, as on the film and series pages.
            This page used to put the rating and note here and "Episode
            Discussion" a hundred lines further down, which is the same fork:
            you had to decide which box a thought belonged in before you had
            finished having it. */}
        <TitleTalk
          itemId={id}
          itemType="tv"
          scope="episode"
          seasonNumber={seasonNum}
          episodeNumber={episode.episode_number}
          itemName={episode.name}
        />

        {/* Images */}
        {episode.images.stills.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Screenshots</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.images.stills.length} images</p>
              </div>
            </div>
            <ImageViewEpisode Bimages={episode.images.stills} />
          </div>
        )}

        {/* Videos */}
        {episode.videos.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Clips & Behind the Scenes</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.videos.length} videos</p>
              </div>
            </div>
            <VideoEpisode videos={episode.videos} />
          </div>
        )}

        {/* Guest Stars */}
        {episode.guest_stars.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Guest Stars</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.guest_stars.length} guests</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {episode.guest_stars.map((star: any) => (
                <Link
                  key={star.id}
                  href={personPath(star.id, star.name)}
                  className="group glass-card rounded-xl overflow-hidden hover:border-surface-600/50 transition-all hover:-translate-y-1"
                >
                  <div className="aspect-[2/3] overflow-hidden">
                    {star.profile_path ? (
                      <img loading="lazy" decoding="async"
                        src={`https://image.tmdb.org/t/p/w185${star.profile_path}`}
                        alt={star.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                        <Users className="w-8 h-8 text-surface-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate">{star.name}</p>
                    <p className="text-xs text-surface-500 mt-0.5 truncate">{star.character}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Crew */}
        {episode.crew.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Crew</h2>
                <p className="text-sm text-surface-500 mt-0.5">{episode.crew.length} crew members</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {episode.crew.map((member: any) => (
                <Link
                  key={member.id}
                  href={personPath(member.id, member.name)}
                  className="group glass-card rounded-xl overflow-hidden hover:border-surface-600/50 transition-all hover:-translate-y-1"
                >
                  <div className="aspect-[2/3] overflow-hidden">
                    {member.profile_path ? (
                      <img loading="lazy" decoding="async"
                        src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                        alt={member.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                        <Clapperboard className="w-8 h-8 text-surface-600" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-white truncate">{member.name}</p>
                    <p className="text-xs text-surface-500 mt-0.5 truncate">{member.job}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
};

export default EpisodePage;
