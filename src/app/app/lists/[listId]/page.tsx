import ListDetail from "@components/profile/ListDetail";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { absoluteUrl } from "@/utils/siteUrl";

type PageProps = { params: Promise<{ listId: string }> };

/**
 * The other most-shared URL in the product, and the other one that had no
 * metadata — a shared list link unfurled as a bare address.
 *
 * Same rule as the profile page: rich metadata only for a list whose own
 * visibility is `public` AND whose owner's profile is public. A list inherits
 * its reach from its author, so a public list on a private profile still gets
 * the anonymous fallback rather than naming the list and its owner in a link
 * preview. Anything else is marked `noindex`.
 */
export async function generateMetadata({ params }: PageProps) {
  const fallback = { title: "List", robots: { index: false, follow: false } };

  try {
    const id = Number((await params).listId);
    if (!Number.isInteger(id)) return fallback;

    const supabase = await createClient();
    const { data: list } = await supabase
      .from("user_lists")
      .select("id, name, description, visibility, users!user_id(username, visibility, deleted_at)")
      .eq("id", id)
      .maybeSingle();

    if (!list || list.visibility !== "public") return fallback;

    const owner = list.users as unknown as
      | { username: string | null; visibility: string | null; deleted_at: string | null }
      | null;
    if (!owner || owner.deleted_at || owner.visibility !== "public") return fallback;

    const name = String(list.name ?? "").trim() || "A list";
    const by = owner.username ? ` by ${owner.username}` : "";
    const description =
      String(list.description ?? "").trim() || `A list of films and shows${by} on LetSee.`;

    return {
      title: `${name}${by}`,
      description,
      alternates: { canonical: absoluteUrl(`/app/lists/${id}`) },
      openGraph: {
        title: `${name}${by}`,
        description,
        url: absoluteUrl(`/app/lists/${id}`),
        type: "website",
      },
      twitter: { card: "summary", title: `${name}${by}`, description },
    };
  } catch {
    return fallback;
  }
}

export default async function ListPage({ params }: PageProps) {
  const { listId } = await params;
  const id = Number(listId);
  if (!Number.isInteger(id)) {
    notFound();
  }
  return <ListDetail listId={id} />;
}
