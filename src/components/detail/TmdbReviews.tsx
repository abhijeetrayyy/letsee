"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, EyeOff, MessageSquareQuote, Star } from "lucide-react";
import { formatLongDate, parseTmdbDate, toIso } from "@/utils/person/dates";

/**
 * What TMDB's own readers wrote, riding the append this page already makes.
 *
 * Worth being straight about the coverage, because it decides how this is
 * built. Measured over 95 films and 78 series:
 *
 *   film   74% carry at least one review, 62% carry three or more
 *   series 40% carry one, 21% carry three
 *
 * and the average hides who is missing. By original language the film figure is
 * 89% English, 81% Korean, 55% Tamil, 50% Hindi, 35% Malayalam; among titles
 * under 500 votes it collapses to 21% for film and 12% for TV. So this is a
 * section that is often simply absent, and the component is built around that
 * rather than apologising for it — no heading, no empty state, no placeholder.
 * It renders or it doesn't exist.
 *
 * Three deliberate restraints:
 *
 *   1. **No brand bar, no `Section` chrome.** The community thread above uses
 *      that, and this must not read as its equal. A stranger on another site is
 *      reference material; the people here are the point.
 *   2. **No avatars**, though 53% of reviews carry one. A row of faces beside
 *      TMDB usernames would sit inches from Friends Who Watched and read as if
 *      these were members.
 *   3. **Nothing is linkified.** 11% of review bodies contain a URL and 14 in
 *      319 are "read my full review at …". Turning a stranger's text into
 *      outbound links from a young community's pages is a spam channel, so URLs
 *      stay as the inert text they are.
 */

export type TmdbReview = {
  id?: string;
  author?: string;
  author_details?: {
    name?: string | null;
    username?: string | null;
    rating?: number | null;
    avatar_path?: string | null;
  } | null;
  content?: string | null;
  created_at?: string | null;
  url?: string | null;
};

type PreparedReview = {
  id: string;
  author: string;
  /** TMDB's 1–10 scale, in half steps. Present on 89% of reviews sampled. */
  rating: number | null;
  date: string | null;
  dateIso: string | null;
  body: string;
  excerpt: string;
  needsExpanding: boolean;
  spoiler: boolean;
  url: string | null;
};

/** Median review runs 843 characters and the 90th percentile 3,126, so nearly
 *  every card would otherwise be a wall — 273 of 319 measured exceed this. */
const EXCERPT_CHARS = 280;

/** Reviews of one and twelve characters exist. The tenth percentile is 205, so
 *  this discards junk without reaching anything anyone wrote on purpose. */
const MIN_CHARS = 40;

/**
 * TMDB stores review bodies as loose markdown with the occasional raw tag —
 * measured across 637 bodies: 84 use `**`, 31 use `_italics_`, 17 contain HTML.
 * Rendered as text those markers show up as literal asterisks; rendered as HTML
 * they are a stranger's markup inside our page. So it is neither: the markers
 * come off and what is left is text.
 */
function plainText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // A markdown link keeps its words and loses its destination — see the note
    // above about not creating outbound links.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)([\s\S]+?)\1/g, "$2")
    .replace(/(^|[\s(])[*_](\S[^*_\n]*?)[*_](?=$|[\s.,;:!?)])/gm, "$1$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function excerptOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= EXCERPT_CHARS) return flat;
  const slice = flat.slice(0, EXCERPT_CHARS);
  const lastSpace = slice.lastIndexOf(" ");
  // Cut at a word, unless the last word is so long that doing so would throw
  // away most of the excerpt.
  const cut = lastSpace > EXCERPT_CHARS * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s.,;:!?—-]+$/, "")}…`;
}

/**
 * 6% of reviews announce spoilers, usually in capitals in the first line. The
 * two errors here are not equal: a false positive costs a click, a false
 * negative costs somebody the ending of a film they were about to watch. So
 * this leans towards hiding, and only steps back for the phrasings that mean
 * the opposite.
 */
function mentionsSpoilers(text: string): boolean {
  if (!/spoiler/i.test(text)) return false;
  return !/\b(no|non|without|zero|free of)[\s-]?spoilers?\b|spoiler[\s-]?free/i.test(text);
}

function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

/**
 * Some TMDB accounts are named after the address that opened them — the newest
 * review of *Demon Slayer: Infinity Castle* is signed with a full gmail
 * address. TMDB publishes it; that is not a reason for this page to republish
 * it to a different audience and hand it to every scraper that reads us. The
 * part before the @ is what they meant as a name anyway.
 */
function displayName(author: string): string {
  const local = author.match(/^([^@\s]+)@[^@\s]+\.[a-z]{2,}$/i);
  return local ? local[1] : author;
}

export function prepareReviews(reviews: TmdbReview[], max: number): PreparedReview[] {
  const prepared: PreparedReview[] = [];

  reviews.forEach((review, index) => {
    const body = plainText(typeof review.content === "string" ? review.content : "");
    if (body.length < MIN_CHARS) return;

    const author =
      review.author_details?.name?.trim() ||
      review.author_details?.username?.trim() ||
      review.author?.trim() ||
      "";
    if (!author) return;

    const rawRating = review.author_details?.rating;
    const parsedDate = parseTmdbDate(review.created_at);
    const excerpt = excerptOf(body);

    prepared.push({
      id: review.id || `${author}-${index}`,
      author: displayName(author),
      rating: typeof rawRating === "number" && rawRating > 0 ? rawRating : null,
      date: parsedDate ? formatLongDate(parsedDate) : null,
      dateIso: parsedDate ? toIso(parsedDate) : null,
      body,
      excerpt,
      // The margin stops a toggle appearing to reveal one more word.
      needsExpanding: body.length > excerpt.length + 20,
      spoiler: mentionsSpoilers(body),
      // Pinned to the one host it is allowed to be. This is the only outbound
      // link the section renders, it is labelled "on TMDB", and a field on a
      // payload is not a good enough reason to let it point anywhere else.
      url:
        typeof review.url === "string" && review.url.startsWith("https://www.themoviedb.org/")
          ? review.url
          : null,
    });
  });

  // Newest first, explicitly. TMDB's own order is by insertion and puts a 2017
  // review of a 2008 film at the top, which reads as the page being stale.
  prepared.sort((a, b) => (b.dateIso ?? "").localeCompare(a.dateIso ?? ""));
  return prepared.slice(0, max);
}

function ReviewCard({ review }: { review: PreparedReview }) {
  const [open, setOpen] = useState(false);
  const concealed = review.spoiler && !open;
  const canToggle = review.spoiler || review.needsExpanding;

  return (
    <article className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
      <header className="flex items-center gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-surface-200">{review.author}</p>
        {review.rating != null && (
          // The same amber chip the hero uses for TMDB's aggregate score,
          // because it is the same scale from the same place.
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
            <Star className="size-3 fill-current" aria-hidden />
            {formatRating(review.rating)}
            <span className="font-normal text-amber-400/60">/10</span>
          </span>
        )}
        {review.date && review.dateIso && (
          <time dateTime={review.dateIso} className="ml-auto shrink-0 text-[11px] text-surface-500">
            {review.date}
          </time>
        )}
      </header>

      {concealed ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-surface-500">
          <EyeOff className="size-3.5 shrink-0" aria-hidden />
          Mentions spoilers
        </p>
      ) : (
        <p
          className={`mt-2 text-sm leading-relaxed text-surface-300 ${
            open ? "whitespace-pre-line" : ""
          }`}
        >
          {open ? review.body : review.excerpt}
        </p>
      )}

      {(canToggle || (open && review.url)) && (
        <div className="mt-2.5 flex items-center gap-4">
          {canToggle && (
            <button
              type="button"
              onClick={() => setOpen((wasOpen) => !wasOpen)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
            >
              {open ? "Show less" : review.spoiler ? "Show anyway" : "Read more"}
              <ChevronDown
                className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          )}
          {/* Attribution, and only once the whole thing is on screen: these are
              somebody's words reproduced in full, and the line back to where
              they wrote them belongs with them. */}
          {open && review.url && (
            <a
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-surface-500 transition-colors hover:text-surface-300"
            >
              on TMDB
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export default function TmdbReviews({
  reviews = [],
  initialCount = 3,
  max = 12,
  className = "",
}: {
  reviews?: TmdbReview[];
  /** Three cards is a section; eight is a page about somebody else's opinions. */
  initialCount?: number;
  /** A hard ceiling on what a single title can add to the DOM. The busiest
   *  title measured carried 16 reviews and the average with any at all was 8. */
  max?: number;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  // Stripping markdown from sixteen bodies is not expensive, but it is pure and
  // it would otherwise run again every time somebody opened a card.
  const prepared = useMemo(() => prepareReviews(reviews, max), [reviews, max]);
  if (prepared.length === 0) return null;

  const visible = showAll ? prepared : prepared.slice(0, initialCount);
  const remaining = prepared.length - visible.length;

  return (
    <section className={className}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
        <MessageSquareQuote className="size-3.5" aria-hidden /> Reviews on TMDB
      </h3>

      <div className="space-y-3">
        {visible.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 rounded-lg border border-surface-700/30 bg-surface-800/60 px-3 py-1.5 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-700 hover:text-white"
        >
          Show {remaining} more
        </button>
      )}
    </section>
  );
}
