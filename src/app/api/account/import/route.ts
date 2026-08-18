import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { parseLetterboxdExport } from "@/utils/letterboxd";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel caps a serverless request body at 4.5MB; stay clearly under it. */
const MAX_BYTES = 4 * 1024 * 1024;
/** A hobbyist's whole life is ~5k films. Beyond this, something is wrong. */
const MAX_RECORDS = 10_000;
/** Postgres has a parameter ceiling; insert the parsed rows in slices. */
const INSERT_CHUNK = 500;

/**
 * POST /api/account/import — upload a Letterboxd export.
 *
 * Parses and stores the rows, then stops. Resolution happens in /process,
 * driven by the client a chunk at a time, because matching thousands of titles
 * against TMDB cannot fit in one request and the queue that was supposed to do
 * it (background_jobs, 024) has no registered handlers and no cron to run them.
 * See 058_letterboxd_import.sql.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Expected a file upload", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("No file received", 400);
  if (file.size === 0) return jsonError("That file is empty", 400);
  if (file.size > MAX_BYTES) {
    return jsonError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is 4MB. Upload the individual CSVs instead.`,
      413,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseLetterboxdExport(bytes, file.name);
  } catch (err) {
    // These messages are written for the user — they say what to do next.
    return jsonError((err as Error).message, 400);
  }

  if (parsed.records.length === 0) {
    return jsonError("No films found in that export.", 400);
  }
  if (parsed.records.length > MAX_RECORDS) {
    return jsonError(`That export has ${parsed.records.length} films; the limit is ${MAX_RECORDS}.`, 413);
  }

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      user_id: userId,
      source: "letterboxd",
      status: "processing",
      total_rows: parsed.records.length,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("import create job:", jobError);
    return jsonError("Couldn't start the import", 500);
  }

  const jobId = Number(job.id);

  const rows = parsed.records.map((r) => ({
    job_id: jobId,
    title: r.title,
    year: r.year,
    letterboxd_uri: r.letterboxdUri,
    watched: r.watched,
    watchlist: r.watchlist,
    favorite: r.favorite,
    rating: r.rating,
    review_text: r.reviewText,
    watched_date: r.watchedDate,
    status: "pending",
  }));

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const slice = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from("import_rows").insert(slice);
    if (error) {
      console.error("import insert rows:", error);
      await supabase
        .from("import_jobs")
        .update({ status: "failed", error: error.message })
        .eq("id", jobId);
      return jsonError("Couldn't read that export", 500);
    }
  }

  return jsonSuccess({
    jobId,
    total: parsed.records.length,
    filesSeen: parsed.filesSeen,
    warnings: parsed.warnings,
    summary: {
      watched: parsed.records.filter((r) => r.watched).length,
      watchlist: parsed.records.filter((r) => r.watchlist).length,
      ratings: parsed.records.filter((r) => r.rating !== null).length,
      reviews: parsed.records.filter((r) => r.reviewText).length,
      favorites: parsed.records.filter((r) => r.favorite).length,
    },
  });
}

/** GET /api/account/import — the caller's most recent imports. */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const { data } = await supabase
    .from("import_jobs")
    .select("id, source, status, total_rows, processed_rows, resolved_rows, created_at, completed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  return jsonSuccess({ jobs: data ?? [] });
}

/**
 * DELETE /api/account/import — forget the import records.
 *
 * The jobs table is a log of runs, not the library. Deleting a row here
 * removes the receipt; the films it matched are already in
 * `user_media_status`, `watched_items`, `user_ratings` and `takes` and are
 * untouched by this. The UI has to say so, because "clear history" reads to
 * some people as "undo my import" and that would be the worst possible
 * misunderstanding to leave standing.
 *
 * A job still `pending` or `processing` is deliberately kept: it is the row
 * the resume path reads, and deleting it would strand a half-finished import
 * with no way to continue it. `import_rows` cascades, so the unresolved rows
 * of a finished job go with their job.
 */
export async function DELETE() {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_jobs")
    .delete()
    .eq("user_id", userId)
    .in("status", ["completed", "failed"])
    .select("id");

  if (error) {
    console.error("import history clear:", error);
    return jsonError("Couldn't clear the import history", 500);
  }

  return jsonSuccess({ cleared: (data ?? []).length });
}
