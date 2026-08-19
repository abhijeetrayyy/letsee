import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { buildYearInReview } from "@/utils/yearInReview";
import YearInReviewCard from "@components/profile/YearInReviewCard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; year: string }> };

/** Nothing before this app existed, and next year isn't over. */
const MIN_YEAR = 2000;

/**
 * The page gates on `year_reviews.is_public`; this did not, so a year somebody
 * chose not to publish was still indexable under a title claiming to be their
 * year in review, over a body that reads "Not shared". A thin page with an
 * inviting title is the worst of both.
 *
 * Now the metadata asks the same question the component does, and refuses to
 * describe what it is not allowed to show.
 */
export async function generateMetadata(ctx: Ctx): Promise<Metadata> {
  const { id, year } = await ctx.params;
  const fallback: Metadata = {
    title: `${year} in review`,
    robots: { index: false, follow: false },
  };

  try {
    const yearNum = Number(year);
    if (!Number.isInteger(yearNum)) return fallback;

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("users")
      .select("id, visibility, deleted_at")
      .eq("username", id)
      .maybeSingle();

    if (!profile?.id || profile.deleted_at) return fallback;
    if (String(profile.visibility ?? "public").toLowerCase().trim() !== "public") return fallback;

    const { data: yearFlag } = await supabase
      .from("year_reviews")
      .select("is_public")
      .eq("user_id", profile.id)
      .eq("year", yearNum)
      .maybeSingle();

    if (yearFlag?.is_public !== true) return fallback;

    const canonical = `/app/profile/${encodeURIComponent(id)}/year/${yearNum}`;
    const title = `@${id}'s ${yearNum} in review`;
    const description = `What @${id} watched in ${yearNum} — the films, the count, and the ones that stuck.`;

    return {
      title,
      description,
      alternates: { canonical },
      openGraph: { title, description, url: canonical, type: "profile" },
      twitter: { card: "summary", title, description },
    };
  } catch {
    return fallback;
  }
}

export default async function YearInReviewPage(ctx: Ctx) {
  const { id: username, year: yearParam } = await ctx.params;

  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > new Date().getUTCFullYear() + 1) {
    notFound();
  }

  const supabase = await createClient();
  const viewerId = await getAuthUserId();

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!profile?.id) notFound();

  const isOwner = viewerId === profile.id;

  const { data: yearFlag } = await supabase
    .from("year_reviews")
    .select("is_public")
    .eq("user_id", profile.id)
    .eq("year", year)
    .maybeSingle();

  const isPublic = yearFlag?.is_public === true;

  if (!isOwner && !isPublic) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-white">Not shared</h1>
        <p className="mt-2 text-surface-400">
          @{username} hasn&apos;t published their {year}.
        </p>
        <Link
          href={`/app/profile/${username}`}
          className="mt-6 inline-flex text-sm text-brand-400 hover:text-brand-300"
        >
          View their profile instead
        </Link>
      </Shell>
    );
  }

  /**
   * The owner reads through their own session; a visitor reads through the
   * admin client.
   *
   * That bypass is deliberate and narrow. The whole point of the per-year flag
   * (059) is to let someone publish one year's summary *without* opening up a
   * followers-only profile, and normal RLS would hide the diary rows this is
   * counted from. The gate above is what authorises it — the flag is the user's
   * own explicit choice, checked before a single row is read.
   */
  const reader = isOwner ? supabase : createAdminClient();

  const data = await buildYearInReview(
    reader as typeof supabase,
    profile.id,
    profile.username as string,
    (profile.avatar_url as string) ?? null,
    year,
  );

  if (data.sparse) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-white">
          {isOwner ? `Not much to show for ${year} yet` : `@${username} had a quiet ${year}`}
        </h1>
        <p className="mt-2 text-surface-400">
          {isOwner
            ? `You've logged ${data.movies + data.shows} things in ${year}. Log a few more and this becomes worth looking at.`
            : "There isn't enough logged to make a card."}
        </p>
        {isOwner && (
          <Link href="/app/quick-add" className="btn-primary text-sm px-5 py-2.5 mt-6 inline-flex">
            Log what you&apos;ve seen
          </Link>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          {isOwner ? `Your ${year}` : `@${username}'s ${year}`}
        </h1>
        <p className="mt-2 text-surface-400">
          {isOwner
            ? "Save it, post it, or keep it to yourself."
            : `What they watched in ${year}.`}
        </p>
      </header>

      <YearInReviewCard data={data} isOwner={isOwner} initialPublic={isPublic} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-surface-950 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">{children}</div>
    </div>
  );
}
