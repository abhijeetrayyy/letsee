import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { guardCron } from "@/utils/cronAuth";
import { jsonError } from "@/utils/apiResponse";
import { fetchTmdbJson, tmdbConfigured } from "@/utils/tmdbClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily job behind the two notifications a person caused themselves.
 *
 *   watchlist_available  a title you saved arrived on a service you hold
 *   new_episode          a show you are watching aired a new episode
 *
 * And the two shelves that need yesterday to exist: "new on your services"
 * and "leaving soon" (docs/WHY_PEOPLE_COME_BACK.md §9 Bets 5 and 9).
 *
 * ── Why a snapshot ─────────────────────────────────────────────────────────
 * TMDB's provider data is JustWatch's, refreshed daily, and carries no dates:
 * nothing says when an offer appeared or when it goes. So this job remembers
 * what was true each day (`title_availability`, 099) and compares. An offer
 * is an *arrival* only when the title was scanned before (`title_scans`) and
 * the offer was not there — never on a title's first scan, which would
 * announce every long-standing offer the day someone saved the title.
 *
 * ── Why nothing fans out ───────────────────────────────────────────────────
 * 092 removed the notifications that wrote one row per follower per event.
 * Everything here is computed per user from that user's own watchlist and
 * their own services, written at most once per user per kind per day, with
 * every arrival of the day folded into that one row.
 *
 * ── Budget ─────────────────────────────────────────────────────────────────
 * The TMDB client paces requests at ~8/s, so ~260 calls fit in the minute
 * this route has. Each phase is capped and reports whether it was truncated,
 * in the shape refresh-taste set; a backlog shows up in the logs, not as a
 * timeout. Titles least recently scanned go first, so a large watchlist is
 * covered over a few days rather than the same head every day.
 */
const TMDB = "https://api.themoviedb.org/3";
const WATCHLIST_TITLES = 120;
const WATCHING_SHOWS = 100;
const CATALOG_PAIRS = 16;
const EXPIRY_LOOKUPS = 30;
const TIME_BUDGET_MS = 48_000;
/** Offers that count as "you can watch it" for an arrival. Rent and buy are stored, never announced. */
const ANNOUNCE_KINDS = new Set(["flatrate", "free", "ads"]);
const KINDS = ["flatrate", "free", "ads", "rent", "buy"] as const;

type Offer = { provider_id: number; provider_name: string };
type ProvidersResponse = { results?: Record<string, Partial<Record<(typeof KINDS)[number], Offer[]>>> };
type ShowResponse = {
  name?: string;
  status?: string;
  last_episode_to_air?: { season_number: number; episode_number: number; name?: string; air_date?: string } | null;
};
type DiscoverResponse = {
  results?: { id: number; title?: string; name?: string; poster_path?: string | null; popularity?: number; vote_count?: number }[];
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const denied = guardCron(request);
  if (denied) return denied;

  if (!tmdbConfigured()) return jsonError("TMDB_READ_TOKEN is missing", 500);

  const supabase = createAdminClient();
  const started = Date.now();
  const overBudget = () => Date.now() - started > TIME_BUDGET_MS;
  const day = today();

  // ── Who holds what, where ───────────────────────────────────────────────
  const [{ data: providerRows }, { data: userRows }] = await Promise.all([
    supabase.from("user_providers").select("user_id, provider_id"),
    supabase.from("users").select("id, watch_region").is("deleted_at", null),
  ]);
  const regionOf = new Map<string, string>();
  for (const u of userRows ?? []) regionOf.set(u.id as string, ((u.watch_region as string) || "US").toUpperCase());
  const held = new Map<string, Set<number>>();
  for (const p of providerRows ?? []) {
    const set = held.get(p.user_id as string) ?? new Set<number>();
    set.add(Number(p.provider_id));
    held.set(p.user_id as string, set);
  }

  const report: Record<string, unknown> = {};

  // ── Phase 1: watchlist availability ─────────────────────────────────────
  const { data: watchlist } = await supabase
    .from("user_media_status")
    .select("user_id, item_id, item_type, item_name, image_url, saved_at, updated_at")
    .eq("status", "watchlist");

  type WatchRow = { user_id: string; item_id: string; item_type: "movie" | "tv"; item_name: string; image_url: string | null; saved_at: string | null; updated_at: string };
  const wl = ((watchlist ?? []) as WatchRow[]).filter((r) => held.has(r.user_id));

  // Distinct (title, region) among people who told us their services.
  const targets = new Map<string, { item_id: string; item_type: "movie" | "tv"; region: string; name: string; image: string | null }>();
  for (const r of wl) {
    const region = regionOf.get(r.user_id) ?? "US";
    const k = `${r.item_type}:${r.item_id}:${region}`;
    if (!targets.has(k)) targets.set(k, { item_id: r.item_id, item_type: r.item_type, region, name: r.item_name, image: r.image_url });
  }

  // Least recently scanned first.
  const targetIds = [...new Set([...targets.values()].map((t) => t.item_id))];
  const { data: scans } = targetIds.length
    ? await supabase.from("title_scans").select("item_id, item_type, region, last_scan_on").in("item_id", targetIds)
    : { data: [] as { item_id: string; item_type: string; region: string; last_scan_on: string }[] };
  const lastScan = new Map<string, string>();
  for (const s of scans ?? []) lastScan.set(`${s.item_type}:${s.item_id}:${s.region}`, s.last_scan_on as string);
  const ordered = [...targets.entries()]
    .filter(([k]) => lastScan.get(k) !== day)
    .sort(([a], [b]) => (lastScan.get(a) ?? "0000").localeCompare(lastScan.get(b) ?? "0000"))
    .slice(0, WATCHLIST_TITLES);

  const existingByKey = new Map<string, { last_seen: string }>();
  if (ordered.length) {
    const ids = [...new Set(ordered.map(([, t]) => t.item_id))];
    const { data: rows } = await supabase
      .from("title_availability")
      .select("item_id, item_type, region, provider_id, kind, last_seen")
      .in("item_id", ids);
    for (const r of rows ?? []) {
      existingByKey.set(`${r.item_type}:${r.item_id}:${r.region}:${r.provider_id}:${r.kind}`, { last_seen: r.last_seen as string });
    }
  }

  const arrivals: { item_id: string; item_type: string; region: string; provider_id: number; provider_name: string; name: string }[] = [];
  const inserts: Record<string, unknown>[] = [];
  const touched: { item_id: string; item_type: string; region: string; provider_id: number; kind: string; provider_name: string; item_name: string; image_url: string | null }[] = [];
  const scanned: { item_id: string; item_type: string; region: string }[] = [];
  let scannedCount = 0;

  for (const [key, t] of ordered) {
    if (overBudget()) break;
    let res: ProvidersResponse;
    try {
      res = await fetchTmdbJson<ProvidersResponse>(`${TMDB}/${t.item_type}/${t.item_id}/watch/providers`, { timeoutMs: 8000 });
    } catch {
      continue;
    }
    scannedCount += 1;
    scanned.push({ item_id: t.item_id, item_type: t.item_type, region: t.region });
    const wasScanned = lastScan.has(key);
    const offers = res.results?.[t.region] ?? {};
    for (const kind of KINDS) {
      for (const o of offers[kind] ?? []) {
        const ok = `${key}:${o.provider_id}:${kind}`;
        if (existingByKey.has(ok)) {
          touched.push({
            item_id: t.item_id, item_type: t.item_type, region: t.region, provider_id: o.provider_id, kind,
            provider_name: o.provider_name, item_name: t.name, image_url: t.image,
          });
        } else {
          inserts.push({
            item_id: t.item_id, item_type: t.item_type, region: t.region, provider_id: o.provider_id, kind,
            provider_name: o.provider_name, item_name: t.name, image_url: t.image, first_seen: day, last_seen: day,
          });
          existingByKey.set(ok, { last_seen: day });
          if (wasScanned && ANNOUNCE_KINDS.has(kind)) {
            arrivals.push({ item_id: t.item_id, item_type: t.item_type, region: t.region, provider_id: o.provider_id, provider_name: o.provider_name, name: t.name });
          }
        }
      }
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from("title_availability").insert(inserts);
    if (error) console.error("refresh-watchlist insert:", error);
  }
  // Touch last_seen on what is still there: one upsert on the primary key
  // (which includes `kind`, so a title that is now rent-only does not keep its
  // stale "stream" row alive). `first_seen` is omitted so the insert-half of
  // the upsert cannot reset it.
  if (touched.length) {
    const { error } = await supabase
      .from("title_availability")
      .upsert(
        touched.map((t) => ({ ...t, last_seen: day })),
        { onConflict: "item_id,item_type,region,provider_id,kind" },
      );
    if (error) console.error("refresh-watchlist touch:", error);
  }
  if (scanned.length) {
    const { error } = await supabase
      .from("title_scans")
      .upsert(scanned.map((s) => ({ ...s, last_scan_on: day })), { onConflict: "item_id,item_type,region" });
    if (error) console.error("refresh-watchlist scans:", error);
  }
  report.watchlistScanned = scannedCount;
  report.watchlistTruncated = ordered.length > scannedCount;
  report.arrivals = arrivals.length;

  // ── Phase 2: one watchlist_available per person, folding the day's arrivals ─
  let arrivalNotices = 0;
  if (arrivals.length) {
    const perUser = new Map<string, typeof arrivals>();
    for (const r of wl) {
      const region = regionOf.get(r.user_id) ?? "US";
      const mine = held.get(r.user_id);
      if (!mine) continue;
      // A title saved today was saved knowing where it is; it is not news.
      // `saved_at` is set once, when the title first lands on the watchlist,
      // and never moved by a note or plan edit (see the status route), so
      // this cannot swallow an arrival for somebody who touched their save
      // this morning.
      if (r.saved_at && r.saved_at.slice(0, 10) === day) continue;
      for (const a of arrivals) {
        if (a.item_id === r.item_id && a.item_type === r.item_type && a.region === region && mine.has(a.provider_id)) {
          perUser.set(r.user_id, [...(perUser.get(r.user_id) ?? []), a]);
        }
      }
    }
    for (const [userId, list] of perUser) {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("notification_type", "watchlist_available")
        .gte("created_at", `${day}T00:00:00Z`);
      if ((count ?? 0) > 0) continue;
      const seen = new Set<string>();
      const items = list.filter((a) => {
        const k = `${a.item_type}:${a.item_id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const providers = [...new Set(items.map((a) => a.provider_name))];
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        notification_type: "watchlist_available",
        actor_id: null,
        target_type: "watchlist",
        target_id: null,
        metadata: {
          count: items.length,
          first_name: items[0]?.name ?? "",
          provider_name: providers.length === 1 ? providers[0] : "your services",
          items: items.slice(0, 12).map((a) => ({ item_id: a.item_id, item_type: a.item_type, item_name: a.name, provider_name: a.provider_name })),
        },
      });
      if (!error) arrivalNotices += 1;
    }
  }
  report.arrivalNotices = arrivalNotices;

  // ── Phase 3: new episodes of shows people are watching ──────────────────
  let episodeNotices = 0;
  let showsChecked = 0;
  if (!overBudget()) {
    const { data: watching } = await supabase
      .from("user_media_status")
      .select("user_id, item_id, item_name")
      .eq("status", "watching")
      .eq("item_type", "tv");
    const showUsers = new Map<string, string[]>();
    for (const w of watching ?? []) showUsers.set(w.item_id as string, [...(showUsers.get(w.item_id as string) ?? []), w.user_id as string]);
    const showIds = [...showUsers.keys()].slice(0, WATCHING_SHOWS);
    const recent = daysAgo(2);
    const perUserShows = new Map<string, { show_id: string; show_name: string; season_number: number; episode_number: number; episode_name: string; air_date: string }[]>();

    for (const showId of showIds) {
      if (overBudget()) break;
      let show: ShowResponse;
      try {
        show = await fetchTmdbJson<ShowResponse>(`${TMDB}/tv/${showId}?language=en-US`, { timeoutMs: 8000 });
      } catch {
        continue;
      }
      showsChecked += 1;
      const last = show.last_episode_to_air;
      if (!last?.air_date || last.air_date < recent || last.air_date > day) continue;
      const users = showUsers.get(showId) ?? [];
      const [{ data: announced }, { data: watched }] = await Promise.all([
        supabase.from("episode_announcements").select("user_id").eq("show_id", showId).eq("season_number", last.season_number).eq("episode_number", last.episode_number).in("user_id", users),
        supabase.from("watched_episodes").select("user_id").eq("show_id", showId).eq("season_number", last.season_number).eq("episode_number", last.episode_number).in("user_id", users),
      ]);
      const skip = new Set([...(announced ?? []).map((a) => a.user_id as string), ...(watched ?? []).map((w) => w.user_id as string)]);
      const fresh = users.filter((u) => !skip.has(u));
      if (!fresh.length) continue;
      const { error } = await supabase.from("episode_announcements").upsert(
        fresh.map((user_id) => ({ user_id, show_id: showId, season_number: last.season_number, episode_number: last.episode_number, announced_on: day })),
        { onConflict: "user_id,show_id,season_number,episode_number", ignoreDuplicates: true },
      );
      if (error) {
        console.error("refresh-watchlist announcements:", error);
        continue;
      }
      for (const u of fresh) {
        perUserShows.set(u, [
          ...(perUserShows.get(u) ?? []),
          { show_id: showId, show_name: show.name ?? "", season_number: last.season_number, episode_number: last.episode_number, episode_name: last.name ?? "", air_date: last.air_date },
        ]);
      }
    }

    for (const [userId, shows] of perUserShows) {
      const first = shows[0];
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        notification_type: "new_episode",
        actor_id: null,
        target_type: "show",
        target_id: null,
        metadata: shows.length === 1
          ? { ...first, count: 1 }
          : { show_name: `${shows.length} shows you're watching`, count: shows.length, shows: shows.slice(0, 8) },
      });
      if (!error) episodeNotices += 1;
    }
  }
  report.showsChecked = showsChecked;
  report.episodeNotices = episodeNotices;

  // ── Phase 4: catalog snapshots, for "new on your services this week" ─────
  let catalogPairs = 0;
  if (!overBudget()) {
    const pairs = new Map<string, { region: string; provider_id: number }>();
    for (const [userId, set] of held) {
      const region = regionOf.get(userId) ?? "US";
      for (const p of set) pairs.set(`${region}:${p}`, { region, provider_id: p });
    }
    const { data: catalogRows } = await supabase.from("catalog_scans").select("region, provider_id, last_scan_on");
    const lastCatalog = new Map((catalogRows ?? []).map((c) => [`${c.region}:${c.provider_id}`, c.last_scan_on as string]));
    const todo = [...pairs.entries()]
      .filter(([k]) => lastCatalog.get(k) !== day)
      .sort(([a], [b]) => (lastCatalog.get(a) ?? "0000").localeCompare(lastCatalog.get(b) ?? "0000"))
      .slice(0, CATALOG_PAIRS);

    for (const [key, pair] of todo) {
      if (overBudget()) break;
      const rows: Record<string, unknown>[] = [];
      for (const type of ["movie", "tv"] as const) {
        try {
          const d = await fetchTmdbJson<DiscoverResponse>(
            `${TMDB}/discover/${type}?watch_region=${pair.region}&with_watch_providers=${pair.provider_id}&with_watch_monetization_types=flatrate&sort_by=popularity.desc&vote_count.gte=50&page=1`,
            { timeoutMs: 8000 },
          );
          for (const r of d.results ?? []) {
            rows.push({
              item_id: String(r.id), item_type: type, region: pair.region, provider_id: pair.provider_id, kind: "flatrate",
              item_name: r.title ?? r.name ?? "", image_url: r.poster_path ?? null, popularity: r.popularity ?? null, vote_count: r.vote_count ?? null,
            });
          }
        } catch {
          // A failed page is retried tomorrow; the pair is not marked scanned.
          continue;
        }
      }
      if (!rows.length) continue;
      const ids = rows.map((r) => r.item_id as string);
      const { data: existing } = await supabase
        .from("title_availability")
        .select("item_id, item_type")
        .eq("region", pair.region).eq("provider_id", pair.provider_id).eq("kind", "flatrate")
        .in("item_id", ids);
      const have = new Set((existing ?? []).map((e) => `${e.item_type}:${e.item_id}`));
      const fresh = rows.filter((r) => !have.has(`${r.item_type}:${r.item_id}`)).map((r) => ({ ...r, first_seen: day, last_seen: day }));
      const stale = rows.filter((r) => have.has(`${r.item_type}:${r.item_id}`));
      if (fresh.length) {
        const { error } = await supabase.from("title_availability").insert(fresh);
        if (error) console.error("refresh-watchlist catalog insert:", error);
      }
      if (stale.length) {
        await supabase
          .from("title_availability")
          .update({ last_seen: day })
          .eq("region", pair.region).eq("provider_id", pair.provider_id).eq("kind", "flatrate")
          .in("item_id", stale.map((r) => r.item_id as string));
      }
      await supabase.from("catalog_scans").upsert({ ...pair, last_scan_on: day }, { onConflict: "region,provider_id" });
      lastCatalog.set(key, day);
      catalogPairs += 1;
    }
    report.catalogPairs = catalogPairs;
    report.catalogTruncated = todo.length > catalogPairs;
  }

  // ── Phase 5: expiry dates, when a source that knows them is configured ───
  const expiryKey = process.env.STREAMING_AVAILABILITY_API_KEY;
  let expiryLookups = 0;
  if (expiryKey && !overBudget()) {
    const base = process.env.STREAMING_AVAILABILITY_API_URL ?? "https://streaming-availability.p.rapidapi.com";
    for (const [, t] of ordered.slice(0, EXPIRY_LOOKUPS)) {
      if (overBudget()) break;
      try {
        const res = await fetch(`${base}/shows/${t.item_type}/${t.item_id}?country=${t.region.toLowerCase()}`, {
          headers: { "X-RapidAPI-Key": expiryKey, "X-RapidAPI-Host": new URL(base).host },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const body = (await res.json()) as { streamingOptions?: Record<string, { service?: { name?: string }; link?: string; expiresOn?: number; expiresSoon?: boolean }[]> };
        expiryLookups += 1;
        const options = body.streamingOptions?.[t.region.toLowerCase()] ?? [];
        for (const o of options) {
          if (!o.expiresOn || !o.service?.name) continue;
          const expires = new Date(o.expiresOn * 1000).toISOString().slice(0, 10);
          await supabase
            .from("title_availability")
            .update({ expires_on: expires, ...(o.link ? { deep_link: o.link } : {}) })
            .eq("item_id", t.item_id).eq("item_type", t.item_type).eq("region", t.region)
            .ilike("provider_name", `${o.service.name.split(" ")[0]}%`);
        }
      } catch {
        // Best effort. The shelf simply carries no date for this title.
      }
    }
  }
  report.expiryLookups = expiryLookups;
  report.expiryConfigured = !!expiryKey;

  return NextResponse.json(
    { ok: true, ...report, ms: Date.now() - started },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
