"use client";
import { TOKENS_DARK, alpha } from "@/design/tokens";

import { useRef, useState } from "react";
import Link from "@components/ui/AppLink";
import { Check, Download, Globe, Loader2, Lock, SlidersHorizontal } from "lucide-react";
import RecapEditor from "@components/profile/RecapEditor";
import { chosenFilms, shows, startEdits } from "@/lib/people/recapEdits";
import { getAvatarUrl, getPosterUrl } from "@/utils/imageUrl";
import type { YearInReview } from "@/utils/yearInReview";
import { exportNodeAsPng } from "@/utils/exportImage";
import FitCard, { nextPaint } from "@components/ds/FitCard";

/**
 * The card people screenshot.
 *
 * Sized 1080×1920 in the export because that's a story, and a story is the only
 * distribution channel this product gets for free. Everything on it is a count
 * of something the user actually did — see the note in yearInReview.ts about
 * why there is no "hours watched" here.
 */
export default function YearInReviewCard({
  data,
  isOwner,
  initialPublic,
}: {
  data: YearInReview;
  isOwner: boolean;
  initialPublic: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edit before you share: older saved recaps have no pool, only their four.
  const pool = data.posterPool ?? data.topRated;
  const [edits, setEdits] = useState(() => startEdits(pool.map((f) => `${f.itemType}:${f.itemId}`)));
  const [editing, setEditing] = useState(false);

  const exportImage = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    setError(null);
    try {
      // Full size for the capture: the card is scaled to fit on screen.
      await nextPaint();
      await exportNodeAsPng(cardRef.current, `letsee-${data.username}-${data.year}.png`);
    } catch {
      setError("Couldn't save the image. Try again, or screenshot the card.");
    } finally {
      setCapturing(false);
    }
  };

  const togglePublic = async () => {
    setToggling(true);
    setError(null);
    try {
      const res = await fetch("/api/year-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: data.year, isPublic: !isPublic }),
      });
      if (!res.ok) throw new Error();
      setIsPublic(!isPublic);
    } catch {
      setError("Couldn't change that. Try again.");
    } finally {
      setToggling(false);
    }
  };

  const posters = chosenFilms(pool, edits);

  return (
    <div className="space-y-6">
      {/* ── The card itself. Fixed size: it's an image, not a layout — shown scaled to fit. ── */}
      <FitCard width={540} height={960} full={capturing}>
        <div
          ref={cardRef}
          data-theme="dark"
          style={{ width: 540, height: 960 }}
          className="relative flex shrink-0 flex-col justify-between bg-page p-10"
        >
          {/* Inline rgba, not `bg-gradient-to-b from-accent-strong/10`.
              Tailwind v4 compiles both gradients and `/opacity` modifiers to
              `color-mix(in oklab, …)`, and html2canvas 1.4 throws outright on
              an unsupported color function — "Attempting to parse an
              unsupported color function 'oklab'" — which would break the export
              this whole card exists for. Anything inside the capture target
              has to use colors html2canvas can actually read. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                `linear-gradient(to bottom, ${alpha(TOKENS_DARK.ink0, 0.1)} 0%, ${alpha(TOKENS_DARK.ink0, 0)} 55%, ${alpha(TOKENS_DARK.ink0, 0.05)} 100%)`,
            }}
          />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {data.year} in review
            </p>
            <div className="mt-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getAvatarUrl(data.avatarUrl)}
                alt=""
                crossOrigin="anonymous"
                className="size-11 rounded-full object-cover"
              />
              <p className="text-xl font-bold text-ink-0">@{data.username}</p>
            </div>
            {edits.line.trim() && <p className="mt-4 line-clamp-2 font-display text-2xl italic leading-tight text-ink-0">{edits.line.trim()}</p>}
          </div>

          {/* People and moments first, counts last. The first line on the
              card names somebody — that is what makes posting it a message
              to them rather than a statistic about you. */}
          {shows(edits, "people") && (data.watchedWith.length > 0 || data.comfortWatch || data.sharedWith) && (
            <div className="relative space-y-3">
              {data.watchedWith.length > 0 && (
                <p className="text-lg leading-snug text-ink-0">
                  Most often with{" "}
                  <span className="font-semibold text-accent-soft">
                    {data.watchedWith[0].username ? `@${data.watchedWith[0].username}` : data.watchedWith[0].name}
                  </span>
                  {data.watchedWith.length > 1 && (
                    <span className="text-ink-300">
                      {" "}and{" "}
                      {data.watchedWith[1].username ? `@${data.watchedWith[1].username}` : data.watchedWith[1].name}
                    </span>
                  )}
                  {data.watchedWith[0].exampleTitle ? (
                    <span className="text-ink-400"> — {data.watchedWith[0].exampleTitle}, for one.</span>
                  ) : (
                    "."
                  )}
                </p>
              )}
              {data.comfortWatch && (
                <p className="text-base text-ink-300">
                  Went back to{" "}
                  <span className="font-semibold text-ink-0">{data.comfortWatch.itemName}</span>
                  {data.rewatches > 1 ? ` — ${data.rewatches} rewatches this year.` : "."}
                </p>
              )}
              {/* The share hook, kept: it names another person. */}
              {data.sharedWith && (
                <p className="text-base text-accent-soft">
                  You and{" "}
                  <span className="font-semibold">@{data.sharedWith.username}</span> both watched{" "}
                  {data.sharedWith.count}{" "}
                  {data.sharedWith.count === 1 ? "film" : "films"} this year
                  {data.sharedWith.exampleTitle ? `, including ${data.sharedWith.exampleTitle}` : ""}.
                </p>
              )}
            </div>
          )}

          {shows(edits, "posters") && posters.length > 0 && (
            <div className="relative">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Rated highest
              </p>
              <div className="flex gap-2.5">
                {posters.map((film) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={film.itemId}
                    src={getPosterUrl(film.imageUrl, "w185")}
                    alt={film.itemName}
                    crossOrigin="anonymous"
                    className="h-42 w-28 rounded-lg border border-line object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {shows(edits, "genres") && data.topGenres.length > 0 && (
            <div className="relative">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
                Mostly
              </p>
              <div className="flex flex-wrap gap-2">
                {data.topGenres.slice(0, 4).map((g) => (
                  <span
                    key={g.genre}
                    className="rounded-full border border-line-strong px-3 py-1 text-sm text-ink-300"
                  >
                    {g.genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Counts, last. Films and shows stay separate — summing them into
              "titles" would make a series equal to a feature. */}
          {shows(edits, "stats") && (
          <div className="relative">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Stat value={data.movies} label={data.movies === 1 ? "film" : "films"} />
              <Stat value={data.shows} label={data.shows === 1 ? "show" : "shows"} />
              <Stat value={data.episodes} label={data.episodes === 1 ? "episode" : "episodes"} />
              {/* A zero says nothing on a card meant to be posted; the cell goes to the days instead. */}
              {data.rewatches > 0 ? (
                <Stat value={data.rewatches} label={data.rewatches === 1 ? "rewatch" : "rewatches"} />
              ) : data.busiestMonth ? (
                <Stat value={data.busiestMonth.count} label={`in ${data.busiestMonth.month}, the busiest month`} />
              ) : null}
            </div>
            {data.busiestMonth && data.rewatches > 0 && (
              <p className="mt-4 text-sm text-ink-400">
                Busiest in{" "}
                <span className="font-semibold text-ink-200">{data.busiestMonth.month}</span> —{" "}
                {data.busiestMonth.count} logged.
              </p>
            )}
          </div>
          )}

          <div className="relative flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-base font-bold text-ink-0">LetSee</span>
            <span className="text-xs text-ink-500">letsee.app/{data.username}</span>
          </div>
        </div>
      </FitCard>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* ── Controls, not part of the image ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportImage}
          disabled={capturing}
          className="btn-primary text-sm px-5 py-2.5 disabled:opacity-60"
        >
          {capturing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Save as image
        </button>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {editing ? "Done editing" : "Edit before you share"}
        </button>

        {isOwner && (
          <button
            type="button"
            onClick={togglePublic}
            disabled={toggling}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm text-ink-300 hover:border-line-input hover:text-ink-0 transition disabled:opacity-60"
          >
            {toggling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPublic ? (
              <Globe className="size-4 text-accent" />
            ) : (
              <Lock className="size-4" />
            )}
            {isPublic ? "Anyone with the link can see this" : "Only you can see this"}
          </button>
        )}

        <Link
          href={`/app/profile/${data.username}`}
          className="text-sm text-ink-500 hover:text-ink-300 transition"
        >
          Back to profile
        </Link>
      </div>

      {editing && (
        <RecapEditor
          pool={pool}
          edits={edits}
          onChange={setEdits}
          sections={[
            { key: "people", label: "Who you watched with" },
            { key: "posters", label: "Posters" },
            { key: "genres", label: "Genres" },
            { key: "stats", label: "Numbers" },
          ]}
        />
      )}

      {isOwner && isPublic && (
        <p className="inline-flex items-center gap-1.5 text-xs text-ink-500">
          <Check className="size-3.5 text-accent" />
          This year is shareable without opening up the rest of your profile.
        </p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  // Sized by digits so "8,000 episodes" never runs into its neighbour.
  const size = value >= 10000 ? "text-3xl" : "text-4xl";
  return (
    <div className="min-w-0">
      <p className={`${size} font-bold leading-none text-ink-0 tabular-nums`}>{value.toLocaleString("en-GB")}</p>
      <p className="mt-1.5 text-sm text-ink-400">{label}</p>
    </div>
  );
}
