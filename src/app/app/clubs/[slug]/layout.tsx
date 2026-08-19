import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
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
 * Read with the request's own client rather than the service key. Clubs carry
 * no visibility column today, but reading them as the caller means the day one
 * is added this file inherits the rule instead of quietly bypassing it.
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

    const supabase = await createClient();
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

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
