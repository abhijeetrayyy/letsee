import Link from "@components/ui/AppLink";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { buildMonthInReview, monthBounds } from "@/utils/monthInReview";
import MonthInReviewCard from "@components/profile/MonthInReviewCard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; month: string }> };

/**
 * A month is private. The year has a publish flag (059) because a year is a
 * statement; a month is a note to yourself, and the card it produces is meant
 * to be dropped into a group chat by hand. So: owner only, never indexed.
 */
export async function generateMetadata(ctx: Ctx): Promise<Metadata> {
  const { month } = await ctx.params;
  const bounds = monthBounds(month);
  return {
    title: bounds ? `${bounds.label}` : "Month in review",
    robots: { index: false, follow: false },
  };
}

export default async function MonthPage(ctx: Ctx) {
  const { id: username, month } = await ctx.params;
  const bounds = monthBounds(month);
  if (!bounds) notFound();

  const viewerId = await getAuthUserId();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .eq("username", username)
    .maybeSingle();
  if (!profile?.id) notFound();

  const isOwner = viewerId === profile.id;
  if (!isOwner) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-white">Just theirs</h1>
        <p className="mt-2 text-surface-400">A month in review is only for the person it belongs to.</p>
        <Link href={`/app/profile/${username}`} className="mt-6 inline-flex text-sm text-brand-400 hover:text-brand-300">
          View their profile instead
        </Link>
      </Shell>
    );
  }

  const data = await buildMonthInReview(
    supabase,
    profile.id,
    profile.username as string,
    (profile.avatar_url as string) ?? null,
    month,
  );
  if (!data) notFound();

  if (data.sparse) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-white">A quiet {bounds.label}</h1>
        <p className="mt-2 text-surface-400">
          {data.viewings === 0 ? "Nothing logged that month." : `${data.viewings} logged. A few more and this becomes a card.`}
        </p>
        <Link href="/app/profile" className="mt-6 inline-flex text-sm text-brand-400 hover:text-brand-300">
          Back to your profile
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Your {bounds.label}</h1>
        <p className="mt-2 text-surface-400">Save it, send it to the people in it, or just look.</p>
      </header>
      <MonthInReviewCard data={data} />
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
