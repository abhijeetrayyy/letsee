import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError } from "@/utils/apiResponse";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { guard } from "@/lib/limits/guard";
import { quotaRefusal, refundQuota, takeQuota } from "@/lib/limits/quota";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/export/letterboxd — the diary as a CSV Letterboxd imports.
 *
 * The way out has to be as easy as the way in, and "as JSON" is not a way out
 * for most people: it is a file they cannot use anywhere. Letterboxd's
 * importer reads a CSV with these columns —
 *
 *   Title, Year, imdbID, tmdbID, WatchedDate, Rating10, Rewatch, Review, Tags
 *
 * — so this writes exactly that, one row per *viewing* (rewatches included),
 * films only, because Letterboxd has no series. TMDB ids go in `tmdbID`, which
 * resolves exactly and saves the name-matching this repo knows the cost of.
 *
 * The private diary note goes into `Review` because that is the only writing
 * column their importer has; it stays private here, and what somebody does
 * with their own export is theirs to decide.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const limited = await guard("export", req);
  if (limited) return limited;
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  // Once every 15 days (lib/limits/quota); handed back if the reads fail.
  const quota = await takeQuota(supabase, "export_letterboxd");
  if (!quota.ok) return quotaRefusal("export_letterboxd", quota.nextAt);
  try {

  const [viewingsRes, titlesRes, ratingsRes, notesRes] = await Promise.all([
    // Every row: `.limit(20000)` was capped at a thousand by the API anyway.
    fetchAllRows((from, to) =>
      supabase
        .from("viewings")
        .select("item_id, item_type, watched_on, rewatch")
        .eq("user_id", userId)
        .eq("item_type", "movie")
        .order("watched_on", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ).then(({ rows, error }) => ({ data: rows, error })),
    fetchAllRows((from, to) =>
      supabase
        .from("user_media_status")
        .select("item_id, item_type, item_name, status")
        .eq("user_id", userId)
        .eq("item_type", "movie")
        .order("item_id", { ascending: true })
        .range(from, to),
    ).then(({ rows, error }) => ({ data: rows, error })),
    fetchAllRows((from, to) => supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId).order("item_id", { ascending: true }).order("item_type", { ascending: true }).range(from, to)).then(({ rows, error }) => ({ data: rows, error })),
    supabase.rpc("my_diary_notes"),
  ]);

  const failed = [viewingsRes, titlesRes, ratingsRes].find((r) => r.error);
  if (failed) throw new Error(String((failed.error as { message?: string })?.message ?? failed.error));

  const names = new Map<string, string>();
  const watchedNoViewing = new Set<string>();
  for (const t of titlesRes.data ?? []) {
    names.set(t.item_id as string, (t.item_name as string) ?? "");
    if (t.status === "watched") watchedNoViewing.add(t.item_id as string);
  }
  const scores = new Map((ratingsRes.data ?? []).filter((r) => r.item_type === "movie").map((r) => [String(r.item_id), Number(r.score)]));
  const notes = new Map(
    ((notesRes.data ?? []) as { item_id: string; item_type: string; review_text: string | null }[])
      .filter((n) => n.item_type === "movie")
      .map((n) => [n.item_id, n.review_text ?? ""]),
  );

  const rows: string[] = ["Title,Year,imdbID,tmdbID,WatchedDate,Rating10,Rewatch,Review,Tags"];
  const seenTitles = new Set<string>();
  for (const v of viewingsRes.data ?? []) {
    const id = v.item_id as string;
    seenTitles.add(id);
    rows.push(
      [
        csvCell(names.get(id) ?? ""),
        "",
        "",
        csvCell(id),
        csvCell(v.watched_on as string),
        csvCell(scores.get(id) ?? null),
        v.rewatch ? "Yes" : "No",
        csvCell(notes.get(id) ?? ""),
        "",
      ].join(","),
    );
  }
  // Titles marked watched before 095 with no viewing row yet: a row without a date.
  for (const id of watchedNoViewing) {
    if (seenTitles.has(id)) continue;
    rows.push([csvCell(names.get(id) ?? ""), "", "", csvCell(id), "", csvCell(scores.get(id) ?? null), "No", csvCell(notes.get(id) ?? ""), ""].join(","));
  }

  const body = "﻿" + rows.join("\r\n") + "\r\n";
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="letsee-diary-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
  } catch (e) {
    console.error("letterboxd export: failed, allowance handed back:", (e as Error).message);
    await refundQuota(supabase, "export_letterboxd");
    return jsonError("Couldn't put your diary together. Try again in a moment.", 500);
  }
}
