import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { buildYearInReview } from "@/utils/yearInReview";
import YearInReviewCard from "@components/profile/YearInReviewCard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; year: string }> };

/** Nothing before this app existed, and next year isn't over. */
const MIN_YEAR = 2000;

export async function generateMetadata(ctx: Ctx) {
  const { id, year } = await ctx.params;
  return {
    title: `@${id}'s ${year} in review`,
    description: `What @${id} watched in ${year}.`,
  };
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
