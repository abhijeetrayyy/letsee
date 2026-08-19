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
 * `public.users.id` is `references auth.users(id) on delete cascade`, and every
 * one of the 61 foreign keys pointing at `public.users(id)` is CASCADE (58) or
 * SET NULL (3). So removing the auth row unwinds the entire library, the social
 * graph, the messages and the writing, and nothing can block it on a foreign
 * key. Verified by reading every `references public.users(id)` in
 * migrations/000_baseline.sql — there are no unqualified ones.
 *
 * The three SET NULL columns are attribution, not content: `club_picks.picked_by`,
 * `user_list_collaborators.added_by` and `user_list_items.added_by`. A club's
 * pick of the week and a shared list's entries survive their author leaving,
 * which is right — they belong to the group.
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

  if (purged.length > 0 || failed.length > 0) {
    console.log(
      `purge-deleted: ${purged.length} purged, ${failed.length} failed, ${(due ?? []).length} due this run`,
    );
  }

  return NextResponse.json(
    {
      success: true,
      due: (due ?? []).length,
      purged: purged.length,
      failed,
      // True when the batch filled, so an operator can tell "nothing to do"
      // from "there is more behind this".
      more: (due ?? []).length === BATCH,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
