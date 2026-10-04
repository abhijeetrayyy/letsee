import RecapHeader from "@components/profile/v2/RecapHeader";
import Link from "@components/ui/AppLink";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { buildMonthInReview, monthBounds } from "@/utils/monthInReview";
import MonthInReviewCard from "@components/profile/MonthInReviewCard";
import TitleCard from "@components/ds/TitleCard";
import { getPosterUrl } from "@/utils/imageUrl";

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
        <h1 className="text-2xl font-medium text-ink-0">Just theirs</h1>
        <p className="mt-2 text-ink-400">A month in review is only for the person it belongs to.</p>
        <Link href={`/app/profile/${username}`} className="mt-6 inline-flex text-sm text-accent hover:text-accent-soft">
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

  const prev = { href: `/app/profile/${username}/month/${shiftMonth(month, -1)}`, label: monthBounds(shiftMonth(month, -1))?.label.split(" ")[0] ?? "Earlier" };
  const next = shiftMonth(month, 1) <= currentMonth() ? { href: `/app/profile/${username}/month/${shiftMonth(month, 1)}`, label: monthBounds(shiftMonth(month, 1))?.label.split(" ")[0] ?? "Later" } : null;

  // A quiet month still shows what was watched, and still leads to the
  // months either side — it used to be one sentence and a dead end.
  if (data.sparse) {
    return (
      <Shell>
        <RecapHeader
          owner="Your"
          label={bounds.label}
          films={data.movies}
          series={data.shows}
          people={[]}
          prev={prev}
          next={next}
          note={data.viewings === 0 ? "Nothing logged that month." : "A quiet month. A few more and it becomes a card you can share."}
        />
        {data.posters.length > 0 && (
          <ul className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4">
            {data.posters.map((f) => (
              <li key={`${f.itemType}:${f.itemId}:${f.watchedOn}`} className="min-w-0">
                <TitleCard id={f.itemId} title={f.itemName} mediaType={f.itemType} imageUrl={getPosterUrl(f.imageUrl, "w342")} role={f.watchedOn ? new Date(`${f.watchedOn}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }) : null} hideState />
              </li>
            ))}
          </ul>
        )}
        <Link href={`/app/profile/${username}`} className="mt-8 inline-flex text-sm font-medium text-accent underline decoration-line-input underline-offset-4">
          Back to your profile
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <RecapHeader
        owner="Your"
        label={bounds.label}
        films={data.movies}
        series={data.shows}
        people={data.watchedWith ? [{ name: data.watchedWith.username ?? data.watchedWith.label, avatarUrl: data.watchedWith.avatarUrl, count: data.watchedWith.count }] : []}
        prev={prev}
        next={next}
        note="Save it, send it to the people in it, or just look."
      />
      <MonthInReviewCard data={data} />
    </Shell>
  );
}

/** yyyy-mm, moved by whole months. */
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-page min-h-screen">
      <div className="max-w-read mx-auto px-4 sm:px-6 py-10 sm:py-14">{children}</div>
    </div>
  );
}
