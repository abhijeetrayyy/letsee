import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "@components/ui/AppLink";
import MediaCard from "@/components/cards/MediaCard";
import Avatar from "@components/ui/Avatar";
import { ArrowLeft, Film, Tv, CalendarClock, Users, Sparkles, Gift, Clock } from "lucide-react";
import { titlePath } from "@/utils/urls";

/**
 * Not for an index. robots.txt asks a crawler not to fetch this; `noindex` says
 * what to do if one arrives anyway — from a pasted link, a referrer, or a
 * crawler that ignores the file. Belt and braces on pages that are either
 * private or pure funnel.
 */
export const metadata = {
  title: "Your watchlist",
  robots: { index: false, follow: false },
};

/**
 * ── Lanes, not a pile ──────────────────────────────────────────────────────
 * A watchlist sorted by date-added surfaces the oldest, most guilt-laden
 * items first, and a single grid of 200 posters is a "pile of shame", not a
 * plan. Since 097 a save can carry *when* it is for and *who* it came from, so
 * the page reads in that order:
 *
 *   Lined up      — for tonight, this weekend, or a date. The plan.
 *   From people   — saved on somebody's word, or recommended to you and not
 *                   yet saved. Each has a name on it, which is the reason.
 *   Someday       — everything else, newest save first.
 *
 * Nothing ages out and nothing is deleted for you: a save with no plan is not
 * a failure, it is a save. And there is no predicted rating on the cards any
 * more — a number nobody asked for, in the slot where the reason you saved it
 * now goes.
 */

export const dynamic = "force-dynamic";

type Item = {
  itemId: string;
  itemName: string;
  itemType: "movie" | "tv";
  imageUrl: string | null;
  genres: string[] | null;
  savedAt: string | null;
  note: string | null;
  saveFor: "tonight" | "weekend" | "someday" | "date" | null;
  saveForDate: string | null;
  withUserId: string | null;
  withName: string | null;
};

type Rec = {
  id: number;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  note: string | null;
  from: { id: string; username: string; avatarUrl: string | null };
  createdAt: string;
};

const FOR_RANK: Record<string, number> = { tonight: 0, weekend: 1, date: 2 };

function forLabel(item: Item): string | null {
  if (item.saveFor === "tonight") return "Tonight";
  if (item.saveFor === "weekend") return "This weekend";
  if (item.saveFor === "date" && item.saveForDate) {
    const d = new Date(`${item.saveForDate}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return null;
}

export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [watchlistResult, recResult] = await Promise.all([
    supabase
      .from("user_media_status")
      .select("item_id, item_name, item_type, image_url, genres, updated_at, saved_at, save_note, save_for, save_for_date, save_with_user_id, save_with_name")
      .eq("user_id", user.id)
      .eq("status", "watchlist"),
    supabase
      .from("title_recommendations")
      .select("id, item_id, item_type, item_name, image_url, note, created_at, from_user_id, users!title_recommendations_from_user_id_fkey(username, avatar_url)")
      .eq("to_user_id", user.id)
      .is("watched_at", null)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const items: Item[] = (watchlistResult.data ?? []).map((row) => ({
    itemId: row.item_id,
    itemName: row.item_name,
    itemType: row.item_type === "tv" ? "tv" : "movie",
    imageUrl: row.image_url,
    genres: row.genres as string[] | null,
    savedAt: (row.saved_at as string | null) ?? (row.updated_at as string | null),
    note: (row.save_note as string | null) ?? null,
    saveFor: (row.save_for as Item["saveFor"]) ?? null,
    saveForDate: (row.save_for_date as string | null) ?? null,
    withUserId: (row.save_with_user_id as string | null) ?? null,
    withName: (row.save_with_name as string | null) ?? null,
  }));

  // "Leaves Netflix on the 30th": expiry dates the daily job has learned for
  // these titles in this region. Null everywhere until a source that knows
  // dates is configured, in which case the line simply does not appear.
  const { data: me } = await supabase.from("users").select("watch_region").eq("id", user.id).maybeSingle();
  const region = ((me?.watch_region as string) || "US").toUpperCase();
  const leaving = new Map<string, { provider: string; on: string }>();
  if (items.length) {
    const { data: exp } = await supabase
      .from("title_availability")
      .select("item_id, item_type, provider_name, expires_on")
      .eq("region", region)
      .in("item_id", items.map((i) => i.itemId))
      .not("expires_on", "is", null)
      .gte("expires_on", new Date().toISOString().slice(0, 10))
      .order("expires_on");
    for (const e of exp ?? []) {
      const k = `${e.item_type}:${e.item_id}`;
      if (!leaving.has(k)) leaving.set(k, { provider: e.provider_name as string, on: e.expires_on as string });
    }
  }

  // Names for the people saves came from.
  const withIds = [...new Set(items.map((i) => i.withUserId).filter((x): x is string => !!x))];
  const withUsers = new Map<string, { username: string; avatarUrl: string | null }>();
  if (withIds.length) {
    const { data } = await supabase.from("users").select("id, username, avatar_url").in("id", withIds);
    for (const u of data ?? []) {
      if (u.username) withUsers.set(u.id, { username: u.username, avatarUrl: u.avatar_url });
    }
  }

  type RecRow = {
    id: number;
    item_id: string;
    item_type: string;
    item_name: string;
    image_url: string | null;
    note: string | null;
    created_at: string;
    from_user_id: string;
    users: { username: string | null; avatar_url: string | null } | { username: string | null; avatar_url: string | null }[] | null;
  };
  const recs: Rec[] = ((recResult.data ?? []) as unknown as RecRow[])
    .map((r) => {
      const u = Array.isArray(r.users) ? r.users[0] : r.users;
      return {
        id: r.id,
        itemId: r.item_id,
        itemType: r.item_type === "tv" ? ("tv" as const) : ("movie" as const),
        itemName: r.item_name,
        imageUrl: r.image_url,
        note: r.note,
        createdAt: r.created_at,
        from: { id: r.from_user_id, username: u?.username ?? "someone", avatarUrl: u?.avatar_url ?? null },
      };
    });
  const recByItem = new Map<string, Rec>();
  for (const r of recs) if (!recByItem.has(`${r.itemType}:${r.itemId}`)) recByItem.set(`${r.itemType}:${r.itemId}`, r);
  const onList = new Set(items.map((i) => `${i.itemType}:${i.itemId}`));

  // ── The lanes ────────────────────────────────────────────────────────────
  const linedUp = items
    .filter((i) => i.saveFor && i.saveFor !== "someday")
    .sort((a, b) => {
      const ra = FOR_RANK[a.saveFor as string] ?? 9;
      const rb = FOR_RANK[b.saveFor as string] ?? 9;
      if (ra !== rb) return ra - rb;
      if (a.saveFor === "date" && b.saveFor === "date") return (a.saveForDate ?? "").localeCompare(b.saveForDate ?? "");
      return (b.savedAt ?? "").localeCompare(a.savedAt ?? "");
    });
  const linedKeys = new Set(linedUp.map((i) => `${i.itemType}:${i.itemId}`));

  const fromPeople = items
    .filter((i) => !linedKeys.has(`${i.itemType}:${i.itemId}`))
    .filter((i) => i.withUserId || i.withName || recByItem.has(`${i.itemType}:${i.itemId}`))
    .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
  const fromKeys = new Set(fromPeople.map((i) => `${i.itemType}:${i.itemId}`));

  const someday = items
    .filter((i) => !linedKeys.has(`${i.itemType}:${i.itemId}`) && !fromKeys.has(`${i.itemType}:${i.itemId}`))
    .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));

  const suggested = recs.filter((r) => !onList.has(`${r.itemType}:${r.itemId}`)).slice(0, 12);

  const movieCount = items.filter((i) => i.itemType === "movie").length;
  const tvCount = items.filter((i) => i.itemType === "tv").length;

  // The person on letsee they named, else the plain name they typed, else
  // whoever recommended it.
  const whoLine = (i: Item): { label: string; avatarUrl: string | null } | null => {
    const named = i.withUserId ? withUsers.get(i.withUserId) : undefined;
    if (named) return { label: named.username, avatarUrl: named.avatarUrl };
    if (i.withName) return { label: i.withName, avatarUrl: null };
    const from = recByItem.get(`${i.itemType}:${i.itemId}`)?.from;
    return from ? { label: from.username, avatarUrl: from.avatarUrl } : null;
  };

  const subtitleFor = (i: Item) => {
    const bits: string[] = [];
    const f = forLabel(i);
    if (f) bits.push(f);
    const l = leaving.get(`${i.itemType}:${i.itemId}`);
    if (l) bits.push(`leaves ${l.provider} ${new Date(`${l.on}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
    const who = whoLine(i);
    if (who) bits.push(`from ${who.label}`);
    if (i.note) bits.push(`“${i.note}”`);
    return bits.length ? bits.join(" · ") : undefined;
  };

  const cardsOf = (list: Item[]): Card[] =>
    list.map((item) => ({
      key: `${item.itemType}:${item.itemId}`,
      id: Number(item.itemId),
      title: item.itemName,
      mediaType: item.itemType,
      posterPath: item.imageUrl,
      genres: item.genres ?? undefined,
      subtitle: subtitleFor(item),
    }));

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 to-surface-950" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <Link href="/app" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-brand-400 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white">Watch later</h1>
          <p className="text-surface-400 mt-2">
            {items.length === 0
              ? "Nothing saved yet."
              : linedUp.length > 0
                ? `${linedUp.length} lined up, ${items.length - linedUp.length} for whenever.`
                : `${items.length} saved. Give one of them a day and it tends to get watched.`}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="pill-glass text-sm flex items-center gap-1">
              <Film className="w-3.5 h-3.5" /> {movieCount} movies
            </span>
            <span className="pill-glass text-sm flex items-center gap-1">
              <Tv className="w-3.5 h-3.5" /> {tvCount} shows
            </span>
            {linedUp.length > 0 && (
              <Link href="/app/tonight" className="pill-glass text-sm flex items-center gap-1 hover:text-brand-300">
                <Sparkles className="w-3.5 h-3.5 text-accent-gold" /> Decide tonight
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {items.length === 0 && suggested.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-surface-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Your watchlist is empty</h2>
            <p className="text-surface-400 mb-6">Save something, and say when you mean to watch it.</p>
            <Link href="/app/search" className="btn-primary">
              Browse Content
            </Link>
          </div>
        ) : (
          <>
            {linedUp.length > 0 && (
              <Lane icon={<CalendarClock className="size-4 text-brand-400" />} title="Lined up" hint="What you said you would watch, and when.">
                <Grid cards={cardsOf(linedUp)} />
              </Lane>
            )}

            {(fromPeople.length > 0 || suggested.length > 0) && (
              <Lane icon={<Users className="size-4 text-brand-400" />} title="From people" hint="Saved on somebody's word. They find out when you watch it.">
                {fromPeople.length > 0 && <Grid cards={cardsOf(fromPeople)} />}
                {suggested.length > 0 && (
                  <div className={fromPeople.length > 0 ? "mt-6" : ""}>
                    <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-surface-500">
                      <Gift className="size-3.5" /> Recommended to you, not saved yet
                    </p>
                    <ul className="divide-y divide-surface-800 rounded-2xl border border-surface-800 bg-surface-900/40">
                      {suggested.map((r) => (
                        <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                          <Avatar src={r.from.avatarUrl} name={r.from.username} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-surface-200">
                              <Link href={`/app/profile/${r.from.username}`} className="font-medium text-white hover:text-brand-300">
                                {r.from.username}
                              </Link>{" "}
                              sent you{" "}
                              <Link href={titlePath(r.itemType, r.itemId, r.itemName)} className="font-medium text-white hover:text-brand-300">
                                {r.itemName}
                              </Link>
                            </p>
                            {r.note && <p className="truncate text-xs text-surface-500">“{r.note}”</p>}
                          </div>
                          <Link
                            href={titlePath(r.itemType, r.itemId, r.itemName)}
                            className="shrink-0 rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-white"
                          >
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Lane>
            )}

            {someday.length > 0 && (
              <Lane icon={<Clock className="size-4 text-surface-500" />} title="Someday" hint="No plan yet, and that is fine.">
                <Grid cards={cardsOf(someday)} />
              </Lane>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type Card = {
  key: string;
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  genres?: string[];
  subtitle?: string;
};

function Grid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {cards.map((c) => (
        <MediaCard
          key={c.key}
          id={c.id}
          title={c.title}
          mediaType={c.mediaType}
          posterPath={c.posterPath}
          genres={c.genres}
          typeLabel={c.mediaType}
          subtitle={c.subtitle}
          className="w-full max-w-[10rem] sm:max-w-[11rem]"
        />
      ))}
    </div>
  );
}

function Lane({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          {icon}
          {title}
        </h2>
        {hint && <p className="text-xs text-surface-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
