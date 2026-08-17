"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";

export type TmdbVideo = {
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
  published_at?: string;
};

/**
 * Everything TMDB already sends, instead of one trailer.
 *
 * The detail page fetched `videos` and used a single `.find()` for the trailer
 * button, discarding the rest. Measured on *Interstellar*: **45 videos** come
 * back — 5 trailers, 13 teasers, 15 featurettes, 7 clips, 5 behind-the-scenes
 * — and 44 of them were thrown away on every render. The data was already paid
 * for by the same request.
 *
 * Grouped by kind rather than listed flat, because the kinds answer different
 * questions: a trailer tells you what it is, a featurette tells you how it was
 * made, a clip shows you what it actually plays like.
 *
 * Thumbnails come from YouTube's own image host, so a shelf of 45 costs no
 * extra API call and no TMDB throttle slot.
 */

/** The order people want them in, not the order TMDB returns them. */
const KIND_ORDER = [
  "Trailer",
  "Teaser",
  "Clip",
  "Featurette",
  "Behind the Scenes",
  "Bloopers",
  "Opening Credits",
];

const KIND_LABEL: Record<string, string> = {
  Trailer: "Trailers",
  Teaser: "Teasers",
  Clip: "Clips",
  Featurette: "Featurettes",
  "Behind the Scenes": "Behind the scenes",
  Bloopers: "Bloopers",
  "Opening Credits": "Opening credits",
};

/** Per kind, so one 15-featurette film cannot bury everything below it. */
const PER_KIND = 6;

export default function VideoShelf({ videos = [] }: { videos?: TmdbVideo[] }) {
  const [playing, setPlaying] = useState<TmdbVideo | null>(null);

  const youtube = videos.filter((v) => v.site === "YouTube" && v.key);
  if (youtube.length === 0) return null;

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABEL[kind] ?? kind,
    // Official cuts first — fan uploads and reaction pieces sit under the same
    // `type` and are rarely what someone opening a film page wants first.
    items: youtube
      .filter((v) => v.type === kind)
      .sort((a, b) => Number(Boolean(b.official)) - Number(Boolean(a.official)))
      .slice(0, PER_KIND),
  })).filter((g) => g.items.length > 0);

  if (grouped.length === 0) return null;

  return (
    <div className="space-y-6">
      {playing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPlaying(null)}
          role="dialog"
          aria-modal="true"
          aria-label={playing.name}
        >
          <button
            type="button"
            onClick={() => setPlaying(null)}
            aria-label="Close video"
            className="absolute right-4 top-4 rounded-full bg-surface-800/80 p-2 text-white transition-colors hover:bg-surface-700"
          >
            <X className="size-5" />
          </button>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${playing.key}?autoplay=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={playing.name}
              />
            </div>
            <p className="mt-3 text-sm text-surface-300">{playing.name}</p>
          </div>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.kind}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
            {group.label}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {group.items.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setPlaying(v)}
                className="group w-52 shrink-0 text-left"
              >
                <span className="relative block aspect-video overflow-hidden rounded-lg bg-surface-800">
                  {/* YouTube's own thumbnail host — no API call, no key. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${v.key}/mqdefault.jpg`}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="size-8 fill-white text-white" />
                  </span>
                </span>
                <span className="mt-1.5 block line-clamp-2 text-xs leading-snug text-surface-300 transition-colors group-hover:text-white">
                  {v.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
