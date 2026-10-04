import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "@components/ui/AppLink";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { getPosterUrl } from "@/utils/imageUrl";
import Avatar from "@components/ui/Avatar";
import Comments from "@components/social/Comments";
import ReplyInRoom from "@components/rooms/ReplyInRoom";
import LikeButton from "@components/reactions/LikeButton";
import { slugify } from "@/utils/urls";
import JsonLd from "@components/seo/JsonLd";
import { reviewLd, breadcrumbLd } from "@/utils/structuredData";
import { parseRouteId, reviewPath, titlePath, profilePath } from "@/utils/urls";
import { publishedReviewText } from "@/utils/publishedReviews";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * ── This page stays rendered per request, and that is the correct call ─────
 *
 * It is in the sitemap, so it is crawled, and a cached render would be much
 * cheaper. It is deliberately not cached anyway, because what this page shows
 * genuinely depends on who is asking: the author sees their own review before
 * the visibility gate below runs, and a follower sees a followers-only review
 * that a stranger must not. ISR caches per URL, not per viewer — so the first
 * render to land in the cache would be served to everyone who asked next. The
 * author opening their own followers-only review would publish it.
 *
 * There is a version of this page that is cacheable: render the public case
 * statically and move the owner/follower case to a client fetch. That is a
 * real change to how the page is built and it is not worth making blind. So
 * the cost work here is the cost work that does not touch the gate — halving
 * the number of round trips each render pays for, below.
 *
 * ── What the halving is ───────────────────────────────────────────────────
 * `generateMetadata` and the component are separate invocations, and the note
 * above `generateMetadata` says "the request is deduped anyway". That is true
 * of `fetch`. supabase-js is not `fetch`, and nothing was deduping it: the
 * review row and the author row were each read twice per render, for four
 * round trips where two would do. React's `cache()` is what actually makes
 * that comment true.
 *
 * The columns are the union of what both callers wanted — the component's set
 * is a superset of the metadata's in both cases, so nothing extra is read.
 */
const getReviewAndAuthor = cache(async (reviewId: number) => {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("watched_items")
    .select("id, user_id, item_id, item_type, item_name, image_url, public_review_text, watched_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (!row) return { review: null, author: null };

  // The words come from the published take, never the copy on this row
  // (utils/publishedReviews.ts): no take on the shelf, no review.
  const [{ data: author }, published] = await Promise.all([
    supabase.from("users").select("id, username, avatar_url, visibility, profile_show_public_reviews").eq("id", row.user_id).maybeSingle(),
    publishedReviewText(supabase, row.user_id, [row]),
  ]);
  const review = { ...row, public_review_text: published.get(`${row.item_type}:${row.item_id}`) ?? null };

  return { review, author };
});


function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Open Graph metadata, so a shared review renders as the review.
 *
 * Without this a pasted link previews as the generic site card, which makes
 * sharing someone's writing look like sharing a homepage — the single cheapest
 * thing standing between a good review and an audience.
 *
 * Deliberately re-queries rather than sharing state with the page: Next runs
 * generateMetadata and the component as separate invocations, and the request
 * is deduped anyway.
 *
 * Only ever built from a review that is already public. A followers-only or
 * hidden review 404s in the component, and its metadata falls back to a title
 * that reveals nothing.
 */
export async function generateMetadata({ params }: RouteParams) {
  /**
   * `index: false` on the fallback, matching the profile and list pages.
   * Everything that lands here — a review that does not exist, one whose author
   * is private, one with the public text removed — is a page with nothing on it
   * that a stranger may read. Without this it was indexable under the generic
   * title "Review", which is a thin page inviting a crawler in.
   */
  const fallback = { title: "Review", robots: { index: false, follow: false } };
  const reviewId = Number(parseRouteId((await params).id));
  if (!Number.isInteger(reviewId)) return fallback;

  try {
    const { review, author } = await getReviewAndAuthor(reviewId);

    if (!review?.public_review_text) return fallback;

    // Metadata is rendered before the component's own gate runs and is served
    // to crawlers with no session, so it must only ever describe a review a
    // stranger is allowed to read.
    const isPublic =
      String(author?.visibility ?? "public").toLowerCase().trim() === "public" &&
      author?.profile_show_public_reviews !== false;
    if (!author?.username || !isPublic) return fallback;

    const title = `@${author.username} on ${review.item_name || "a film"}`;
    const description = review.public_review_text.slice(0, 200);
    const image = review.image_url ? getPosterUrl(review.image_url, "w500") : undefined;

    return {
      title,
      description,
      // No canonical here meant this page had none at all. It is also why the
      // /app title and description live on the page rather than the layout —
      // `alternates` is inherited, so a layout-level canonical would have
      // pointed this review at the app home.
      alternates: { canonical: reviewPath(reviewId, review.item_name) },
      openGraph: {
        url: reviewPath(reviewId, review.item_name),
        title,
        description,
        type: "article",
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description,
        ...(image ? { images: [image] } : {}),
      },
    };
  } catch {
    return fallback;
  }
}

/**
 * Permalink for a single public review — the thing you can actually reply to.
 *
 * Required, not cosmetic: comments already support item_type='review' in the
 * API and the notify_comment_reply trigger already resolves the review owner,
 * but without this page the resulting notification linked to a 404.
 */
export default async function ReviewPage({ params }: RouteParams) {
  const reviewId = Number(parseRouteId((await params).id));
  if (!Number.isInteger(reviewId)) notFound();

  const supabase = await createClient();

  // The viewer lookup and the review itself have nothing to say to each other
  // until both have arrived, so they are asked for at the same time rather
  // than one after the other. `getReviewAndAuthor` is the same call
  // `generateMetadata` already made this request, so it costs nothing here.
  const [viewerId, { review, author }] = await Promise.all([
    // From the token, not a round trip to the auth server.
    getAuthUserId(),
    getReviewAndAuthor(reviewId),
  ]);

  if (!review?.public_review_text) notFound();
  if (!author?.username) notFound();

  // Respect the author's visibility and their "show public reviews" toggle.
  const isOwner = viewerId === review.user_id;
  if (!isOwner) {
    if (author.profile_show_public_reviews === false) notFound();

    const visibility = String(author.visibility ?? "public").toLowerCase();
    if (visibility === "private") notFound();
    if (visibility === "followers") {
      if (!viewerId) notFound();
      const { data: follow } = await supabase
        .from("user_connections")
        .select("id")
        .eq("follower_id", viewerId)
        .eq("followed_id", review.user_id)
        .maybeSingle();
      if (!follow) notFound();
    }
  }

  const detailHref = titlePath(review.item_type, review.item_id, review.item_name);

  return (
    <>
      {/*
        A review is the one page here that can earn a rich result of its own —
        the author, the rating and the film it is about are all facts the page
        already shows. It only reaches this point when the review is public and
        the author's visibility allows it, so the graph never asserts anything a
        visitor cannot already read.
      */}
      <JsonLd
        data={[
          reviewLd({
            body: review.public_review_text as string,
            authorName: author.username as string,
            authorUrl: profilePath(author.username as string),
            datePublished: review.watched_at as string | null,
            itemName: (review.item_name as string) ?? "",
            itemType: review.item_type === "tv" ? "tv" : "movie",
            itemId: review.item_id as string,
            itemImage: review.image_url as string | null,
            url: reviewPath(review.id, review.item_name),
          }),
          breadcrumbLd([
            { name: (review.item_name as string) ?? "Title", path: detailHref },
            { name: `Review by ${author.username}`, path: reviewPath(review.id, review.item_name) },
          ]),
        ]}
      />
    <article className="w-full">
      {/* The film, on a dark band lit by its own poster; then the words on paper. */}
      <header data-theme="dark" className="relative isolate overflow-hidden bg-page">
        <div aria-hidden className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getPosterUrl(review.image_url, "w342")} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60" style={{ filter: "blur(64px) saturate(1.5)" }} />
          <div className="absolute inset-0 bg-linear-to-b from-page/20 via-page/50 to-page" />
        </div>
        <div className="mx-auto flex max-w-read items-end gap-5 px-4 pb-10 pt-12 sm:gap-6 sm:pt-16">
          <Link href={detailHref} aria-label={`Open ${review.item_name ?? "the film"}`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getPosterUrl(review.image_url, "w342")} alt="" className="img-fade aspect-2/3 w-28 rounded-media object-cover shadow-2xl ring-1 ring-inset ring-line-strong sm:w-36" />
          </Link>
          <div className="min-w-0 pb-1">
            <Link href={`/app/profile/${author.username}`} className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-ink-0">
              <Avatar src={author.avatar_url} name={author.username} size={24} />
              <span className="font-medium text-ink-0">{author.username}</span> on
            </Link>
            <h1 className="mt-2 text-3xl leading-tight text-ink-0 sm:text-5xl">
              <Link href={detailHref} className="hover:underline hover:decoration-line-input hover:underline-offset-4">
                {review.item_name}
              </Link>
            </h1>
            <p className="mt-2 font-mono text-xs uppercase tracking-wide text-ink-400">
              {review.item_type === "tv" ? "Series" : "Film"} · watched {formatDate(review.watched_at)}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-read px-4 pb-16 pt-8 sm:pt-10">
        <p className="whitespace-pre-wrap font-display text-2xl leading-relaxed text-ink-0">{review.public_review_text}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <LikeButton targetType="review" targetId={review.id} />
          <ReplyInRoom authorId={author.id as string} author={author.username as string} quote={review.public_review_text as string} />
        </div>

        {/* Replying to one person's take is a direct social act — unlike
            commenting into the void on a title page. */}
        <section className="mt-10">
          <Comments itemId={String(review.id)} itemType="review" />
        </section>
      </div>
    </article>
    </>
  );
}
