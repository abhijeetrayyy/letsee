import type { Metadata } from "next";
import { createAnonClient } from "@/utils/supabase/anon";
import { absoluteUrl } from "@/utils/siteUrl";

/**
 * A club's metadata, from a layout because the page itself is a client
 * component — it opens with `useSWR` against `/api/clubs/[slug]`, so there is
 * no server render to hang `generateMetadata` off.
 *
 * These are public pages with real, unrepeatable content on them: a name a
 * group chose, a description they wrote, and a film they are all watching this
 * week. Every one of them was inheriting the site title and the site
 * description, which told a crawler that all of them were the same page.
 *
 * ── Which client, and why it is not `createClient()` ───────────────────────
 * This used to read with the cookie client, on the stated reasoning that doing
 * so keeps the read subject to whatever visibility rule clubs might grow. The
 * reasoning is right; the client was wrong, and it is the fault the August
 * incident calls R2 — now for the fourth time in this codebase, after
 * `sitemap.ts`, `relatedData.ts` and `lists/[listId]`.
 *
 * `createAnonClient()` is not the service key. It carries the anon key and is
 * fully subject to RLS, so the day `clubs` grows a visibility column this file
 * inherits that rule exactly as before. What it does not do is read a cookie —
 * and one cookie read anywhere in a route's tree opts the whole route out of
 * caching, which is what kept every club page rendering from scratch on every
 * hit. A club's name and description are the same bytes for everybody.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const fallback: Metadata = { title: "Club" };

  try {
    const { slug } = await params;
    if (!slug) return fallback;

    const supabase = createAnonClient();
    const { data: club } = await supabase
      .from("clubs")
      .select("name, description, member_count")
      .eq("slug", slug)
      .maybeSingle();

    if (!club?.name) return fallback;

    const name = String(club.name).trim();
    const members = Number(club.member_count ?? 0);
    const description =
      String(club.description ?? "").trim() ||
      `${name} is a film club on LetSee${
        members > 0 ? ` with ${members} member${members === 1 ? "" : "s"}` : ""
      }. See what they are watching this week.`;

    const canonical = `/app/clubs/${slug}`;

    return {
      title: name,
      description,
      alternates: { canonical },
      openGraph: { title: name, description, url: canonical, type: "website" },
      twitter: { card: "summary", title: name, description },
    };
  } catch {
    return fallback;
  }
}

/**
 * `revalidate` is not enough on its own here — R3.
 *
 * On a `[param]` segment with no `generateStaticParams`, Next treats the route
 * as fully dynamic and emits `no-store` however long the revalidate window is.
 * An empty array is the documented way to say "prerender nothing, cache on
 * demand": the first visitor to a club renders it, everyone after that for the
 * next hour is served from the CDN.
 *
 * An hour rather than a day because the page carries a member count and the
 * week's pick, and both move. The page's own data is fetched client-side
 * anyway, so this window only governs the shell and its metadata.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
