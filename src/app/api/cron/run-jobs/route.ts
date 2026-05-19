import { NextResponse } from "next/server";
import { claimNextJob, dispatchJob } from "@/utils/jobRunner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Run pending background jobs (called by Vercel Cron or manually).
 * Processes up to 5 jobs per invocation to stay within duration limits.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
