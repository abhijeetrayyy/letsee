import { NextResponse } from "next/server";
import { claimNextJob, dispatchJob } from "@/utils/jobRunner";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { guardCron } from "@/utils/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Run pending background jobs (called by Vercel Cron or manually).
 * Processes up to 5 jobs per invocation to stay within duration limits.
 */
export async function GET(request: Request) {
  // Fail closed. This used to skip the check entirely when CRON_SECRET was
  // unset, which left a service-role endpoint open to anyone with the URL.
  const denied = guardCron(request);
  if (denied) return denied;

  const results: { jobId: number; jobType: string; status: string }[] = [];
  const MAX_JOBS_PER_RUN = 5;

  for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
    const job = await claimNextJob();
    if (!job) break;

    try {
      await dispatchJob(job.id, job.job_type, job.payload);
      results.push({ jobId: job.id, jobType: job.job_type, status: "completed" });
    } catch (err) {
      results.push({
        jobId: job.id,
        jobType: job.job_type,
        status: "failed",
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
