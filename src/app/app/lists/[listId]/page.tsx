import { cache } from "react";
import ListDetail from "@components/profile/ListDetail";
import { notFound } from "next/navigation";
import { createAnonClient } from "@/utils/supabase/anon";
import { absoluteUrl } from "@/utils/siteUrl";
import { listPath, parseRouteId } from "@/utils/urls";
import JsonLd from "@components/seo/JsonLd";
import { itemListLd, breadcrumbLd } from "@/utils/structuredData";

/** A list can hold hundreds of films; the graph does not need all of them. */
const LIST_LD_MAX = 50;

type PageProps = { params: Promise<{ listId: string }> };

/**
 * This page is cacheable, and until now it was not — for no reason at all.
 *
 * Everything rendered on the server here is JSON-LD and `<head>` metadata
 * describing a **public** list. The list itself is `<ListDetail>`, a client
 * component that fetches its own data after hydration. So the server output is
 * identical for every visitor, signed in or not: there is nothing personal in
 * it to keep out of a shared cache.
 *
 * What made it uncacheable was `createClient()`. It reads cookies, reading
 * cookies forces a dynamic render, and so every crawler hit on every list URL
 * in the sitemap paid for two database queries and a full render to produce
 * bytes identical to the ones served a second earlier. That is the same fault
 * — a session read where no session is needed — that took the site down on
 * 23 August, in its third location.
 *
 * `generateStaticParams` returning `[]` is the other half, and it is not
 * optional: on a `[param]` route Next treats `revalidate` alone as advisory
 * and still emits `no-store`. Empty means "prerender nothing at build time,
 * cache each one the first time somebody asks for it".
 *
 * An hour rather than a day, unlike the title pages. The reason is link
 * unfurling: when someone flips a list to public and immediately pastes the
 * URL into a chat, the OG tags come from this cached render. A day-long window
 * would show the anonymous "List" fallback card for the rest of the day, on
 * the exact share that matters most. An hour bounds that, and still turns a
 * crawl of every list into one render each instead of one render per hit.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

/**
 * `generateMetadata` and the component below ran the same query twice.
 *
 * Next invokes them separately and the comment on the review page asserts the
 * request is "deduped anyway" — that is true of `fetch`, and supabase-js is
 * not `fetch`. React's `cache()` is what actually makes it true here: one
 * round trip per request instead of two, on every render that misses the
 * cache above.
 */
const getList = cache(async (id: number) => {
  const supabase = createAnonClient();
  const { data } = await supabase
    .from("user_lists")
    .select("id, name, description, visibility, users!user_id(username, visibility, deleted_at)")
    .eq("id", id)
    .maybeSingle();
  return data;
});

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

    const list = await getList(id);

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
  const list = await getList(id);

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
    // Read as `anon` too, and that is a second opinion rather than a
    // convenience: `user_list_items_select` only returns rows whose parent
    // list is public, so the database independently confirms the `isPublic`
    // test above before any of this reaches a shared cache.
    const supabase = createAnonClient();
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
