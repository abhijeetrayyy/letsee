import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getPosterUrl } from "@/utils/imageUrl";
import Avatar from "@components/ui/Avatar";
import Comments from "@components/social/Comments";
import LikeButton from "@components/reactions/LikeButton";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

function slug(title: string): string {
  return title.trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
}

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
 * Permalink for a single public review — the thing you can actually reply to.
 *
 * Required, not cosmetic: comments already support item_type='review' in the
 * API and the notify_comment_reply trigger already resolves the review owner,
 * but without this page the resulting notification linked to a 404.
 */
export default async function ReviewPage({ params }: RouteParams) {
  const reviewId = Number((await params).id);
  if (!Number.isInteger(reviewId)) notFound();

  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const viewerId = viewer?.id ?? null;

  const { data: review } = await supabase
    .from("watched_items")
    .select("id, user_id, item_id, item_type, item_name, image_url, public_review_text, watched_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review?.public_review_text) notFound();

  const { data: author } = await supabase
    .from("users")
    .select("id, username, avatar_url, visibility, profile_show_public_reviews")
    .eq("id", review.user_id)
    .maybeSingle();

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

  const detailHref = `/app/${review.item_type}/${review.item_id}-${slug(review.item_name ?? "")}`;

  return (
    <div className="min-h-screen w-full bg-surface-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <article className="rounded-2xl border border-surface-700/60 bg-surface-900/40 p-5 sm:p-6">
          {/* Author */}
          <div className="flex items-center gap-3">
            <Link href={`/app/profile/${author.username}`}>
              <Avatar src={author.avatar_url} name={author.username} size="md" />
            </Link>
            <div className="min-w-0">
              <Link
                href={`/app/profile/${author.username}`}
                className="font-semibold text-white hover:text-brand-400 transition-colors"
              >
                @{author.username}
              </Link>
              <p className="text-xs text-surface-500">{formatDate(review.watched_at)}</p>
            </div>
          </div>

          {/* The film */}
          <Link href={detailHref} className="mt-5 flex gap-4 group">
            <img
              src={getPosterUrl(review.image_url, "w185")}
              alt={review.item_name ?? ""}
              className="w-20 aspect-[2/3] rounded-lg object-cover shrink-0 shadow-lg"
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white group-hover:text-brand-400 transition-colors">
                {review.item_name}
              </h1>
              <p className="mt-1 text-xs uppercase tracking-wider text-surface-500">
                {review.item_type === "tv" ? "TV Series" : "Film"}
              </p>
            </div>
          </Link>

          {/* The review */}
          <p className="mt-5 whitespace-pre-wrap leading-relaxed text-surface-200">
            {review.public_review_text}
          </p>

          <div className="mt-4 pt-4 border-t border-surface-800/60">
            <LikeButton targetType="review" targetId={review.id} />
          </div>
        </article>

        {/* Replying to one person's take is a direct social act — unlike
            commenting into the void on a title page. */}
        <section className="mt-8">
          <Comments itemId={String(review.id)} itemType="review" />
        </section>
      </div>
    </div>
  );
}
