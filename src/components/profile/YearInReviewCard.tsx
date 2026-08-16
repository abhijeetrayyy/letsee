"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, Globe, Loader2, Lock } from "lucide-react";
import { getAvatarUrl, getPosterUrl } from "@/utils/imageUrl";
import type { YearInReview } from "@/utils/yearInReview";

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

  const exportImage = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    setError(null);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#09090b",
        // The card renders at 540×960 so it reads on screen; ×2 lands exactly
        // on 1080×1920 without any resampling.
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Couldn't render the image");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `letsee-${data.username}-${data.year}.png`;
      a.click();
      URL.revokeObjectURL(url);
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

  const posters = data.topRated.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* ── The card itself. Fixed size: it's an image, not a layout. ── */}
      <div className="overflow-x-auto">
        <div
          ref={cardRef}
          style={{ width: 540, height: 960 }}
          className="relative mx-auto flex shrink-0 flex-col justify-between bg-surface-950 p-10"
        >
          {/* Inline rgba, not `bg-gradient-to-b from-brand-500/10`.
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
                "linear-gradient(to bottom, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0) 55%, rgba(34,197,94,0.05) 100%)",
            }}
          />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-400">
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
              <p className="text-xl font-bold text-white">@{data.username}</p>
            </div>
          </div>

          {/* Counts. Films and shows stay separate — summing them into
              "titles" would make a series equal to a feature. */}
          <div className="relative grid grid-cols-2 gap-y-7">
            <Stat value={data.movies} label={data.movies === 1 ? "film" : "films"} />
            <Stat value={data.shows} label={data.shows === 1 ? "show" : "shows"} />
            <Stat value={data.episodes} label={data.episodes === 1 ? "episode" : "episodes"} />
            <Stat value={data.ratingsGiven} label={data.ratingsGiven === 1 ? "rating" : "ratings"} />
          </div>

          {posters.length > 0 && (
            <div className="relative">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">
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
                    className="h-[168px] w-28 rounded-lg border border-surface-800 object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {data.topGenres.length > 0 && (
            <div className="relative">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">
                Mostly
              </p>
              <div className="flex flex-wrap gap-2">
                {data.topGenres.slice(0, 4).map((g) => (
                  <span
                    key={g.genre}
                    className="rounded-full border border-surface-700 px-3 py-1 text-sm text-surface-300"
                  >
                    {g.genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="relative space-y-2">
            {data.busiestMonth && (
              <p className="text-base text-surface-300">
                Busiest in{" "}
                <span className="font-semibold text-white">{data.busiestMonth.month}</span> —{" "}
                {data.busiestMonth.count} logged.
              </p>
            )}
            {/* The share hook: it names another person, so posting it is a
                message to them rather than a statistic about you. */}
            {data.sharedWith && (
              <p className="text-base text-brand-300">
                You and{" "}
                <span className="font-semibold">@{data.sharedWith.username}</span> both watched{" "}
                {data.sharedWith.count}{" "}
                {data.sharedWith.count === 1 ? "film" : "films"} this year
                {data.sharedWith.exampleTitle ? `, including ${data.sharedWith.exampleTitle}` : ""}.
              </p>
            )}
          </div>

          <div className="relative flex items-baseline justify-between border-t border-surface-800 pt-4">
            <span className="text-base font-bold text-white">LetSee</span>
            <span className="text-xs text-surface-500">letsee.app/{data.username}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

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

        {isOwner && (
          <button
            type="button"
            onClick={togglePublic}
            disabled={toggling}
            className="inline-flex items-center gap-2 rounded-xl border border-surface-700 px-4 py-2.5 text-sm text-surface-300 hover:border-surface-600 hover:text-white transition disabled:opacity-60"
          >
            {toggling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPublic ? (
              <Globe className="size-4 text-brand-400" />
            ) : (
              <Lock className="size-4" />
            )}
            {isPublic ? "Anyone with the link can see this" : "Only you can see this"}
          </button>
        )}

        <Link
          href={`/app/profile/${data.username}`}
          className="text-sm text-surface-500 hover:text-surface-300 transition"
        >
          Back to profile
        </Link>
      </div>

      {isOwner && isPublic && (
        <p className="inline-flex items-center gap-1.5 text-xs text-surface-500">
          <Check className="size-3.5 text-brand-400" />
          This year is shareable without opening up the rest of your profile.
        </p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-5xl font-bold leading-none text-white tabular-nums">{value}</p>
      <p className="mt-1.5 text-sm text-surface-400">{label}</p>
    </div>
  );
}
