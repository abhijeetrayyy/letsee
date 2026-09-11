"use client";

import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { getAvatarUrl, getPosterUrl } from "@/utils/imageUrl";
import type { MonthInReview } from "@/utils/monthInReview";
import { exportNodeAsPng } from "@/utils/exportImage";

/**
 * The month card. Square, because it is for a grid and a group chat rather
 * than a story. Every colour inside the capture target is inline rgba, for
 * the html2canvas reason YearInReviewCard documents.
 */
export default function MonthInReviewCard({ data }: { data: MonthInReview }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportImage = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    setError(null);
    try {
      await exportNodeAsPng(cardRef.current, `letsee-${data.username}-${data.month}.png`);
    } catch {
      setError("Couldn't save the image. Try again, or screenshot the card.");
    } finally {
      setCapturing(false);
    }
  };

  const best = data.bestNight;
  const bestDate = best
    ? new Date(`${best.watchedOn}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric" })
    : null;

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div
          ref={cardRef}
          style={{ width: 540, height: 540 }}
          className="relative mx-auto flex shrink-0 flex-col justify-between bg-surface-950 p-9"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "linear-gradient(to bottom, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0) 60%)" }}
          />
          <div className="relative flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-400">{data.label}</p>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(data.avatarUrl)} alt="" crossOrigin="anonymous" className="size-7 rounded-full object-cover" />
              <p className="text-sm font-semibold text-white">@{data.username}</p>
            </div>
          </div>

          <div className="relative space-y-3">
            {data.watchedWith && (
              <p className="text-2xl leading-tight text-white">
                Mostly with{" "}
                <span className="font-semibold text-brand-300">
                  {data.watchedWith.username ? `@${data.watchedWith.username}` : data.watchedWith.label}
                </span>
                .
              </p>
            )}
            {best && (
              <p className="text-base text-surface-300">
                {bestDate}: <span className="font-semibold text-white">{best.itemName}</span>
                {best.companions.length ? ` with ${best.companions.slice(0, 2).join(" and ")}` : ""}
                {best.rewatch ? ", again" : ""}.
              </p>
            )}
          </div>

          {data.posters.length > 0 && (
            <div className="relative flex gap-2.5">
              {data.posters.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${f.itemType}:${f.itemId}`}
                  src={getPosterUrl(f.imageUrl, "w185")}
                  alt={f.itemName}
                  crossOrigin="anonymous"
                  className="h-[150px] w-[100px] rounded-lg border border-surface-800 object-cover"
                />
              ))}
            </div>
          )}

          <div className="relative flex items-end justify-between border-t border-surface-800 pt-4">
            <div className="flex gap-6">
              <Stat value={data.movies} label={data.movies === 1 ? "film" : "films"} />
              <Stat value={data.shows} label={data.shows === 1 ? "show" : "shows"} />
              <Stat value={data.rewatches} label={data.rewatches === 1 ? "rewatch" : "rewatches"} />
              <Stat value={data.daysWithSomething} label={data.daysWithSomething === 1 ? "day" : "days"} />
            </div>
            <span className="text-sm font-bold text-white">LetSee</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportImage}
          disabled={capturing}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {capturing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Save as image
        </button>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold leading-none text-white tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-surface-400">{label}</p>
    </div>
  );
}
