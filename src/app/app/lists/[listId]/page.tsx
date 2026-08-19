import ListDetail from "@components/profile/ListDetail";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { absoluteUrl } from "@/utils/siteUrl";
import { listPath, parseRouteId } from "@/utils/urls";
import JsonLd from "@components/seo/JsonLd";
import { itemListLd, breadcrumbLd } from "@/utils/structuredData";

/** A list can hold hundreds of films; the graph does not need all of them. */
const LIST_LD_MAX = 50;

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
    const id = Number(parseRouteId((await params).listId));
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
      alternates: { canonical: absoluteUrl(listPath(id, name)) },
      openGraph: {
        title: `${name}${by}`,
        description,
        url: absoluteUrl(listPath(id, name)),
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
  const id = Number(parseRouteId(listId));
  if (!Number.isInteger(id)) {
    notFound();
  }

  /**
   * `itemListLd` was written with the other schema helpers and then wired to
   * nothing. A list is the one page type here that maps onto a schema.org type
   * exactly — an ItemList of films — and it is published in the sitemap, so it
   * was being crawled with no structured data at all.
   *
   * Read on the server because ListDetail is a client component that fetches
   * its own data: JSON-LD added after hydration is JSON-LD a crawler does not
   * see. Public lists only, matching `generateMetadata` above — a private list
   * gets the anonymous fallback there and must not be described here either.
   *
   * Capped at 50 entries. A list of four hundred films is a legitimate thing to
   * make and not a thing to serialise into every page load.
   */
  const supabase = await createClient();
  const { data: list } = await supabase
    .from("user_lists")
    .select("id, name, description, visibility, users!user_id(username, visibility, deleted_at)")
    .eq("id", id)
    .maybeSingle();

  const owner = Array.isArray(list?.users) ? list?.users[0] : (list?.users as
    | { username: string | null; visibility: string | null; deleted_at: string | null }
    | null
    | undefined);

  const isPublic =
    !!list &&
    list.visibility === "public" &&
    !!owner &&
    !owner.deleted_at &&
    String(owner.visibility ?? "public").toLowerCase().trim() === "public";

  let itemRows: { item_id: string; item_type: string; item_name: string }[] = [];
  if (isPublic) {
    const { data } = await supabase
      .from("user_list_items")
      .select("item_id, item_type, item_name")
      .eq("list_id", id)
      .order("position", { ascending: true })
      .limit(LIST_LD_MAX);
    itemRows = (data ?? []) as typeof itemRows;
  }

  return (
    <>
      {isPublic && list && (
        <JsonLd
          data={[
            itemListLd({
              name: String(list.name ?? "A list"),
              description: list.description,
              url: listPath(id, list.name as string),
              items: itemRows.map((r) => ({
                itemId: r.item_id,
                itemType: r.item_type,
                name: r.item_name,
              })),
            }),
            breadcrumbLd([
              { name: "Lists", path: "/app/lists" },
              { name: String(list.name ?? "A list"), path: listPath(id, list.name as string) },
            ]),
          ]}
        />
      )}
      <ListDetail listId={id} />
    </>
  );
}
