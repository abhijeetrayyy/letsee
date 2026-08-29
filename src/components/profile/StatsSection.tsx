"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Panel, SegmentedControl, StatTile } from "./stats/Chrome";
import RatingHistogram from "./stats/RatingHistogram";
import CountBars, { type CountBar } from "./stats/CountBars";
import GenreTable from "./stats/GenreTable";
import DriftChart from "./stats/DriftChart";
import TitleDrawer from "./stats/TitleDrawer";
import { SERIES, deltaColor } from "./stats/palette";
import { formatStars } from "@/utils/ratingScale";
import type {
  ComparedTitle,
  MediaFilter,
  TasteStats,
  TitleQuery,
} from "./stats/types";

type OverviewStats = {
  watchedCount: number;
  favoriteCount: number;
  watchlistCount: number;
  watchingCount: number;
  watchedThisYear: number;
  movieCount: number;
  tvCount: number;
  episodesCount: number;
};

/**
 * The profile's Stats section.
 *
 * ── One request, not three ─────────────────────────────────────────────────
 * This used to call /stats/ratings and /stats/years (and take genres as a prop
 * the page had computed from its own full-library read). Each of those routes
 * selected every matching row and counted them in JavaScript, which was slow
 * and — past PostgREST's default 1000-row ceiling — silently wrong.
 * `profile_taste_stats` (089) does the arithmetic in Postgres and answers in
 * one call with about sixty rows of JSON regardless of library size.
 *
 * Still fetched from the client rather than the server: DeferredSection only
 * mounts this when it is about to scroll into view, so a visitor who never
 * reaches the bottom of a profile never pays for any of it.
 */
export default function StatsSection({
  userId,
  isOwner = false,
  stats,
}: {
  userId: string;
  isOwner?: boolean;
  stats?: OverviewStats;
}) {
  const [data, setData] = useState<TasteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [drill, setDrill] = useState<TitleQuery | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/profile/stats?userId=${encodeURIComponent(userId)}`,
      );
      if (!response.ok) {
        setError(true);
        return;
      }
      const payload = await response.json();
      setData(payload.data as TasteStats);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-surface-700/60 bg-surface-900/40 p-6">
        <LoadingSpinner size="md" className="shrink-0 border-t-white" />
        <p className="animate-pulse text-sm text-surface-500">Loading stats…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
        <p className="text-sm text-red-300">Couldn&rsquo;t load stats.</p>
        <button
          type="button"
          onClick={fetchData}
          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-200 transition-colors hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  const { coverage, you, crowd, comparison, genres, decades, drift, activity } = data;
  const showYou = data.show_scores && you != null;
  const hasAnything =
    coverage.watched_total > 0 || (you?.count ?? 0) > 0 || genres.length > 0;

  if (!hasAnything) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/50 p-12 text-center">
        <div className="mb-4 text-4xl">📊</div>
        <p className="text-sm text-surface-400">
          {isOwner
            ? "No stats yet. Start watching and rating to see your statistics here."
            : "No stats available yet."}
        </p>
      </div>
    );
  }

  const mediaOptions: { value: MediaFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "movie", label: "Films" },
    { value: "tv", label: "TV" },
  ];

  const decadeBars: CountBar[] = decades.map((decade) => ({
    key: decade.decade,
    label: `${String(decade.decade).slice(2)}s`,
    count: decade.count,
    detail: [
      decade.your_avg != null && showYou ? `You: ${decade.your_avg.toFixed(1)}` : null,
      decade.crowd_avg != null ? `TMDB: ${decade.crowd_avg.toFixed(1)}` : null,
    ].filter((line): line is string => Boolean(line)),
  }));

  const activityBars: CountBar[] = activity.map((year) => ({
    key: year.year,
    label: String(year.year),
    count: year.count,
    detail: [`${year.movie} film${year.movie === 1 ? "" : "s"}`, `${year.tv} TV`],
  }));

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Watched" value={String(stats.watchedCount)} />
          <StatTile label="This Year" value={String(stats.watchedThisYear)} />
          <StatTile label="Films" value={String(stats.movieCount)} />
          <StatTile label="TV Shows" value={String(stats.tvCount)} />
          <StatTile label="Episodes" value={String(stats.episodesCount)} />
          <StatTile label="Favorites" value={String(stats.favoriteCount)} />
          <StatTile label="Watchlist" value={String(stats.watchlistCount)} />
          <StatTile label="Watching" value={String(stats.watchingCount)} />
        </div>
      )}

      {/* Say it out loud rather than drawing a chart over a half-filled cache.
          Only the owner sees this — a visitor cannot act on it, and neither
          really can the owner: no promise about *when* the rest arrive,
          because the backfill is run by hand rather than on a schedule. */}
      {isOwner && (coverage.crowd_pending > 0 || coverage.crowd_unrated > 0) && (
        <p className="rounded-lg border border-surface-800 bg-surface-900/40 px-4 py-2.5 text-xs text-surface-400">
          TMDB scores are in for {coverage.crowd_known} of your{" "}
          {coverage.watched_total} watched titles, and the charts below count
          only those.
          {coverage.crowd_pending > 0 && (
            <> {coverage.crowd_pending} still to fetch ({coverage.crowd_pct}% done).</>
          )}
          {coverage.crowd_unrated > 0 && (
            <>
              {" "}
              {coverage.crowd_unrated} {coverage.crowd_unrated === 1 ? "has" : "have"}{" "}
              no TMDB score at all — too few votes, or a title TMDB doesn&rsquo;t
              carry.
            </>
          )}
        </p>
      )}

      <Panel
        title="Ratings: yours and everyone else's"
        subtitle="How many titles sit at each score — what you gave them, next to what TMDB's voters gave the same films."
        action={
          <SegmentedControl
            value={mediaFilter}
            options={mediaOptions}
            onChange={setMediaFilter}
            ariaLabel="Filter ratings by media type"
          />
        }
      >
        <RatingHistogram
          you={you?.histogram ?? []}
          crowd={crowd.histogram}
          filter={mediaFilter}
          showYou={showYou}
          onSelect={(source, score) =>
            setDrill({
              source,
              bucket: score,
              type: mediaFilter === "all" ? null : mediaFilter,
              label:
                `${source === "you" ? "You rated" : "TMDB rates"} these ${score}/10` +
                (mediaFilter === "all" ? "" : mediaFilter === "movie" ? " · Films" : " · TV"),
            })
          }
        />
      </Panel>

      {showYou && comparison && comparison.count > 0 && (
        <Panel
          title="You against the crowd"
          subtitle={`Over the ${comparison.count} title${comparison.count === 1 ? "" : "s"} that carry both your score and TMDB's.`}
        >
          <div className="grid grid-cols-3 gap-3">
            <StatTile
              label="Your average"
              value={comparison.avg_you?.toFixed(2) ?? "—"}
              hint={you?.average != null ? `${formatStars(Math.round(you.average))}★` : undefined}
              tone={SERIES.you}
            />
            <StatTile
              label="TMDB average"
              value={comparison.avg_crowd?.toFixed(2) ?? "—"}
              tone={SERIES.crowd}
            />
            <StatTile
              label="The gap"
              value={
                comparison.avg_delta == null
                  ? "—"
                  : `${comparison.avg_delta > 0 ? "+" : ""}${comparison.avg_delta.toFixed(2)}`
              }
              hint={
                comparison.avg_delta == null
                  ? undefined
                  : Math.abs(comparison.avg_delta) < 0.25
                    ? "you're in step"
                    : comparison.avg_delta > 0
                      ? "you rate higher"
                      : "you rate lower"
              }
              tone={deltaColor(comparison.avg_delta)}
            />
          </div>

          <AgreementBar comparison={comparison} />

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <TitleDeltaList
              heading="You loved these more than anyone"
              titles={comparison.champions}
              emptyLabel="Nothing you rate above the crowd yet."
            />
            <TitleDeltaList
              heading="Everyone else loved these more"
              titles={comparison.disappointments}
              emptyLabel="Nothing you rate below the crowd yet."
            />
          </div>
        </Panel>
      )}

      <Panel
        title="Genres"
        subtitle="What you actually watch — and where your scores part company with everyone else's."
      >
        <GenreTable
          genres={genres}
          showYou={showYou}
          onSelect={(genre) =>
            setDrill({ source: "you", genre, label: `Everything you've watched in ${genre}` })
          }
        />
      </Panel>

      {decadeBars.length > 0 && (
        <Panel
          title="When it came out"
          subtitle="Your library by the decade each title was released."
        >
          <CountBars
            bars={decadeBars}
            onSelect={(bar) =>
              setDrill({
                source: "you",
                decade: Number(bar.key),
                label: `Watched from the ${bar.label}`,
              })
            }
          />
        </Panel>
      )}

      {showYou && drift.length >= 2 && (
        <Panel
          title="Have you got harsher?"
          subtitle="Your average score by the year you gave it, against TMDB's average for those same titles."
        >
          <DriftChart points={drift} showYou={showYou} />
        </Panel>
      )}

      {activityBars.length > 0 && (
        <Panel title="What you watched, by year">
          <CountBars bars={activityBars} emptyLabel="No dated watches yet." />
        </Panel>
      )}

      {drill && (
        <TitleDrawer userId={userId} query={drill} onClose={() => setDrill(null)} />
      )}
    </div>
  );
}

/**
 * Three parts of one whole, so one stacked bar rather than three numbers or a
 * pie. The 2px gaps keep the segments from reading as a single block.
 */
function AgreementBar({
  comparison,
}: {
  comparison: NonNullable<TasteStats["comparison"]>;
}) {
  const total = Math.max(1, comparison.count);
  const segments = [
    { key: "kinder", label: "You rated higher", value: comparison.kinder, color: SERIES.you },
    { key: "agrees", label: "Within a point", value: comparison.agrees, color: "#52525b" },
    { key: "harsher", label: "You rated lower", value: comparison.harsher, color: SERIES.crowd },
  ];

  return (
    <div className="mt-5">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="h-full rounded-[2px] transition-all duration-500"
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: segment.color,
              minWidth: segment.value > 0 ? "3px" : 0,
            }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-surface-400">
        {segments.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-2">
            <span
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: segment.color }}
              aria-hidden
            />
            {segment.label}
            <span className="tabular-nums font-medium text-surface-200">
              {segment.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TitleDeltaList({
  heading,
  titles,
  emptyLabel,
}: {
  heading: string;
  titles: ComparedTitle[];
  emptyLabel: string;
}) {
  return (
    <div>
      <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-surface-400">
        {heading}
      </h4>
      {titles.length === 0 ? (
        <p className="text-xs text-surface-600">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {titles.slice(0, 5).map((title) => (
            <li
              key={`${title.item_type}:${title.item_id}`}
              className="flex items-center gap-3 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-surface-200">
                {title.title ?? "Untitled"}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-surface-500">
                <span style={{ color: SERIES.you }}>{title.you}</span>
                {" · "}
                <span style={{ color: SERIES.crowd }}>{title.crowd.toFixed(1)}</span>
              </span>
              <span
                className="w-11 shrink-0 rounded px-1.5 py-0.5 text-right text-xs font-medium tabular-nums"
                style={{
                  color: deltaColor(title.delta),
                  backgroundColor: `${deltaColor(title.delta)}1a`,
                }}
              >
                {title.delta > 0 ? "+" : ""}
                {title.delta.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
