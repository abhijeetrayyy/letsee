"use client";
import { TOKENS_DARK, alpha } from "@/design/tokens";

import { useRef, useState } from "react";
import { Download, Loader2, SlidersHorizontal } from "lucide-react";
import RecapEditor from "@components/profile/RecapEditor";
import { chosenFilms, shows, startEdits } from "@/lib/people/recapEdits";
import { getAvatarUrl, getPosterUrl } from "@/utils/imageUrl";
import type { MonthInReview } from "@/utils/monthInReview";
import { exportNodeAsPng } from "@/utils/exportImage";
import FitCard, { nextPaint } from "@components/ds/FitCard";

/**
 * The month card. Square, because it is for a grid and a group chat rather
 * than a story. Every colour inside the capture target is inline rgba, for
 * the html2canvas reason YearInReviewCard documents.
 */
export default function MonthInReviewCard({ data }: { data: MonthInReview }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState(() => startEdits(data.posters.map((f) => `${f.itemType}:${f.itemId}`)));
  const [editing, setEditing] = useState(false);
  const posters = chosenFilms(data.posters, edits);

  const exportImage = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    setError(null);
    try {
      // Full size for the capture: the card is scaled to fit on screen.
      await nextPaint();
      await exportNodeAsPng(cardRef.current, `letsee-${data.username}-${data.month}.png`);
    } catch {
      setError("Couldn't save the image. Try again, or screenshot the card.");
    } finally {
      setCapturing(false);
    }
  };

  const best = data.bestNight;
  const bestDate = best
    ? new Date(`${best.watchedOn}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric" })
    : null;

  return (
    <div className="space-y-6">
      <FitCard width={540} height={540} full={capturing}>
        <div
          ref={cardRef}
          data-theme="dark"
          style={{ width: 540, height: 540 }}
          className="relative flex shrink-0 flex-col justify-between bg-page p-9"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: `linear-gradient(to bottom, ${alpha(TOKENS_DARK.ink0, 0.1)} 0%, ${alpha(TOKENS_DARK.ink0, 0)} 60%)` }}
          />
          <div className="relative flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{data.label}</p>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(data.avatarUrl)} alt="" crossOrigin="anonymous" className="size-7 rounded-full object-cover" />
              <p className="text-sm font-semibold text-ink-0">@{data.username}</p>
            </div>
          </div>

          <div className="relative space-y-3">
            {edits.line.trim() && <p className="line-clamp-2 font-display text-2xl italic leading-tight text-ink-0">{edits.line.trim()}</p>}
            {shows(edits, "with") && data.watchedWith && (
              <p className="text-2xl leading-tight text-ink-0">
                Mostly with{" "}
                <span className="font-semibold text-accent-soft">
                  {data.watchedWith.username ? `@${data.watchedWith.username}` : data.watchedWith.label}
                </span>
                .
              </p>
            )}
            {shows(edits, "best") && best && (
              <p className="text-base text-ink-300">
                {bestDate}: <span className="font-semibold text-ink-0">{best.itemName}</span>
                {best.companions.length ? ` with ${best.companions.slice(0, 2).join(" and ")}` : ""}
                {best.rewatch ? ", again" : ""}.
              </p>
            )}
          </div>

          {shows(edits, "posters") && posters.length > 0 && (
            <div className="relative flex gap-2.5">
              {posters.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${f.itemType}:${f.itemId}`}
                  src={getPosterUrl(f.imageUrl, "w185")}
                  alt={f.itemName}
                  crossOrigin="anonymous"
                  className="h-37.5 w-25 rounded-lg border border-line object-cover"
                />
              ))}
            </div>
          )}

          <div className="relative flex items-end justify-between border-t border-line pt-4">
            <div className={`flex gap-6 ${shows(edits, "stats") ? "" : "invisible"}`}>
              <Stat value={data.movies} label={data.movies === 1 ? "film" : "films"} />
              <Stat value={data.shows} label={data.shows === 1 ? "show" : "shows"} />
              {/* A zero says nothing on a card meant to be posted. */}
              {data.rewatches > 0 && <Stat value={data.rewatches} label={data.rewatches === 1 ? "rewatch" : "rewatches"} />}
              <Stat value={data.daysWithSomething} label={data.daysWithSomething === 1 ? "day" : "days"} />
            </div>
            <span className="text-sm font-bold text-ink-0">LetSee</span>
          </div>
        </div>
      </FitCard>

      {error && <p className="text-sm text-danger">{error}</p>}

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
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {editing ? "Done editing" : "Edit before you share"}
        </button>
      </div>
      {editing && (
        <RecapEditor
          pool={data.posters}
          edits={edits}
          onChange={setEdits}
          sections={[
            { key: "with", label: "Who you watched with" },
            { key: "best", label: "The night to remember" },
            { key: "posters", label: "Posters" },
            { key: "stats", label: "Numbers" },
          ]}
        />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold leading-none text-ink-0 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink-400">{label}</p>
    </div>
  );
}
