import { createAdminClient } from "@/utils/supabase/server";

type JobPayload = Record<string, unknown>;

/**
 * Schedule a background job to be picked up by the cron runner.
 */
export async function scheduleJob(
  jobType: string,
  payload: JobPayload,
  options?: { scheduledAt?: Date; maxAttempts?: number }
): Promise<{ id: number } | null> {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("background_jobs")
      .insert({
        job_type: jobType,
        payload,
        max_attempts: options?.maxAttempts ?? 3,
        scheduled_at: (options?.scheduledAt ?? new Date()).toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[JobRunner] Failed to schedule job "${jobType}":`, err);
    return null;
  }
}

/**
 * Mark a job as running.
 */
export async function startJob(jobId: number): Promise<boolean> {
  try {
    const supabase = await createAdminClient();
    const { error } = await supabase
      .from("background_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`[JobRunner] Failed to start job ${jobId}:`, err);
    return false;
  }
}

/**
 * Mark a job as completed with optional result data.
 */
export async function completeJob(jobId: number, result?: JobPayload): Promise<void> {
  try {
    const supabase = await createAdminClient();
    await supabase
      .from("background_jobs")
      .update({
        status: "completed",
        result: result ?? {},
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    console.error(`[JobRunner] Failed to complete job ${jobId}:`, err);
  }
}

/**
 * Mark a job as failed with an error message.
 */
export async function failJob(jobId: number, error: string): Promise<void> {
  try {
    const supabase = await createAdminClient();
    await supabase
      .from("background_jobs")
      .update({
        status: "failed",
        error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    console.error(`[JobRunner] Failed to fail job ${jobId}:`, err);
  }
}

/**
 * Pick up the next pending job (for cron runner).
 */
export async function claimNextJob(): Promise<{ id: number; job_type: string; payload: JobPayload } | null> {
  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from("background_jobs")
      .select("id, job_type, payload")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    await supabase
      .from("background_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return data as { id: number; job_type: string; payload: JobPayload };
  } catch (err) {
    console.error("[JobRunner] Failed to claim next job:", err);
    return null;
  }
}

/**
 * Just logs the migration reminder - the RPC is created via migration.
 */
export async function ensureJobHelpers(): Promise<void> {
  // The increment_job_attempts RPC function is created via migration 024_background_jobs.sql
  console.log("[JobRunner] Ensure migrations are applied: increment_job_attempts RPC");
}

/**
 * Simple job map for dispatching.
 */
const JOB_HANDLERS: Record<string, (payload: JobPayload) => Promise<void>> = {};

export function registerJobHandler(jobType: string, handler: (payload: JobPayload) => Promise<void>): void {
  JOB_HANDLERS[jobType] = handler;
}

export async function dispatchJob(jobId: number, jobType: string, payload: JobPayload): Promise<void> {
  const handler = JOB_HANDLERS[jobType];
  if (!handler) {
    await failJob(jobId, `No handler registered for job type: ${jobType}`);
    return;
  }

  try {
    await handler(payload);
    await completeJob(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await failJob(jobId, message);
  }
}
