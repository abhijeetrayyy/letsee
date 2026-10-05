import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { jsonError } from "@/utils/apiResponse";
import { guardCron } from "@/utils/cronAuth";

export const dynamic = "force-dynamic";
/** Well inside Vercel's ceiling; the batch below is sized to finish long before it. */
export const maxDuration = 60;

/**
 * Hard-delete accounts whose grace period has run out.
 *
 * `/api/account/delete` tells the user, in writing, "Account scheduled for
 * deletion on <date>. You have 30 days to reactivate." Until this route existed
 * that sentence was false: it wrote `deleted_at` and `deletion_scheduled_at`
 * and nothing ever read the second column to act on it. `vercel.json` had one
 * cron and it was about television. Every watched item, rating, review, DM,
 * comment and take was retained indefinitely, the username stayed reserved, and
 * the row in `auth.users` — with the email on it — was never touched.
 *
 * ── How the delete propagates ──────────────────────────────────────────────
 *
 * One call to `auth.admin.deleteUser` is the whole operation.
 * `public.users.id` references `auth.users(id)` on delete cascade, and the
 * foreign keys into `public.users(id)` are CASCADE for what was theirs (diary,
 * ratings, favourites, lists, words, follows, passes, conversations) and SET
 * NULL for attribution on shared things (`club_picks.picked_by`, list
 * `added_by`, `save_with_user_id`, `comments.user_id`, a report's reporter).
 *
 * Before the cascade reaches anything, the `users_leaving` trigger (migration
 * 119) keeps what belongs to other people: a group they made passes to its
 * longest-standing member (closing only if nobody else is in it), a list
 * someone helps keep passes to its first collaborator, a Tonight session to
 * the next person in it, and a comment someone replied to stays as an empty
 * marker with no author so the replies keep their place.
 *
 * It also clears sign-ups nobody finished — never confirmed, never named, a
 * month on (`abandoned_signups`). Nothing else ever could.
 *
 * ── Safety ─────────────────────────────────────────────────────────────────
 *
 * - Fails closed without CRON_SECRET (see guardCron). This is the most
 *   destructive endpoint in the app; it does not get the old fail-open guard.
 * - Requires BOTH `deleted_at` set and `deletion_scheduled_at` in the past. A
 *   row with a null schedule is never purged, so a partial write cannot be
 *   read as consent.
 * - Batched. A run deletes at most BATCH accounts and the next run picks up the
 *   rest, so this cannot become an unbounded loop against the Auth API.
 * - Per-account error isolation: one failure is recorded and the run continues,
 *   because aborting would let a single bad row block every account behind it.
 *
 * Reactivation must work before this is scheduled — migration 082. Without it
 * the grace period is a countdown with no cancel button.
 */
const BATCH = 25;

export async function GET(request: Request) {
  const denied = guardCron(request);
  if (denied) return denied;

  const supabase = createAdminClient();

  const { data: due, error } = await supabase
    .from("users")
    .select("id, username, deletion_scheduled_at")
    .not("deleted_at", "is", null)
    .not("deletion_scheduled_at", "is", null)
    .lt("deletion_scheduled_at", new Date().toISOString())
    .order("deletion_scheduled_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("purge-deleted: could not read the queue:", error);
    return jsonError(error.message || "Failed to read the deletion queue", 500);
  }

  const purged: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const user of due ?? []) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      // Loud: an account that should be gone and is not is exactly the thing a
      // retention promise turns into a problem.
      console.error(`purge-deleted: ${user.id} failed:`, deleteError.message);
      failed.push({ id: user.id, reason: deleteError.message });
      continue;
    }
    purged.push(user.id);
  }

  // Sign-ups nobody finished: never confirmed, never given a username, a month
  // on. No profile to keep, nothing anyone else holds. Same batch, same
  // isolation; a failure here never stops the accounts above.
  const abandoned: string[] = [];
  const { data: stale, error: staleError } = await supabase.rpc("abandoned_signups", { p_days: 30, p_limit: BATCH });
  if (staleError) console.error("purge-deleted: could not list abandoned sign-ups:", staleError.message);
  for (const row of (stale ?? []) as { id: string }[]) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(row.id);
    if (deleteError) {
      failed.push({ id: row.id, reason: deleteError.message });
      continue;
    }
    abandoned.push(row.id);
  }

  if (purged.length > 0 || abandoned.length > 0 || failed.length > 0) {
    console.log(
      `purge-deleted: ${purged.length} purged, ${abandoned.length} abandoned sign-ups removed, ${failed.length} failed, ${(due ?? []).length} due this run`,
    );
  }

  return NextResponse.json(
    {
      success: true,
      due: (due ?? []).length,
      purged: purged.length,
      abandoned: abandoned.length,
      failed,
      // True when the batch filled, so an operator can tell "nothing to do"
      // from "there is more behind this".
      more: (due ?? []).length === BATCH,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
