import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderRun, type RenderRunVariantEvent } from "@/lib/services/render.service";
import type {
  RenderJob,
  RenderJobItemStatus,
  RenderJobStatus,
} from "@/types/domain";

type RenderJobRow = Record<string, unknown> & {
  render_job_items?: Array<Record<string, unknown>>;
};

const ACTIVE_JOB_STATUSES: RenderJobStatus[] = ["queued", "processing"];

function computeProgress(statuses: RenderJobItemStatus[]) {
  let done = 0;
  let failed = 0;
  let queued = 0;
  let rendering = 0;

  for (const s of statuses) {
    if (s === "queued") queued += 1;
    else if (s === "rendering") rendering += 1;
    else if (s === "failed") {
      failed += 1;
      done += 1;
    } else {
      done += 1;
    }
  }

  return {
    total: statuses.length,
    done,
    failed,
    queued,
    rendering,
  };
}

function toRenderJob(row: RenderJobRow): RenderJob {
  const statuses = (row.render_job_items ?? [])
    .map((item) => item.status as RenderJobItemStatus)
    .filter(Boolean);
  return {
    id: row.id as string,
    runId: row.run_id as string,
    priority: Number(row.priority ?? 100),
    status: row.status as RenderJobStatus,
    queuedAt: row.queued_at as string,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    progress: computeProgress(statuses),
  };
}

async function getRenderJobByIdAdmin(id: string): Promise<RenderJob | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("render_jobs")
    .select("*, render_job_items(status)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toRenderJob(data as RenderJobRow);
}

async function updateJobItemFromEvent(jobId: string, event: RenderRunVariantEvent): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (event.status === "rendering") {
    const { data: existing } = await admin
      .from("render_job_items")
      .select("attempts")
      .eq("job_id", jobId)
      .eq("variant_id", event.variantId)
      .maybeSingle();
    const attempts = Number(existing?.attempts ?? 0) + 1;
    await admin
      .from("render_job_items")
      .update({
        status: "rendering",
        attempts,
        worker_id: "render.service",
        started_at: now,
        last_error: null,
      })
      .eq("job_id", jobId)
      .eq("variant_id", event.variantId);
    return;
  }

  if (event.status === "rendered") {
    await admin
      .from("render_job_items")
      .update({
        status: "rendered",
        completed_at: now,
        last_error: null,
      })
      .eq("job_id", jobId)
      .eq("variant_id", event.variantId);
    return;
  }

  if (event.status === "skipped") {
    await admin
      .from("render_job_items")
      .update({
        status: "skipped",
        completed_at: now,
        last_error: null,
      })
      .eq("job_id", jobId)
      .eq("variant_id", event.variantId);
    return;
  }

  await admin
    .from("render_job_items")
    .update({
      status: "failed",
      completed_at: now,
      last_error: event.errorMessage ?? "Render failed",
    })
    .eq("job_id", jobId)
    .eq("variant_id", event.variantId);
}

async function finalizeJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: currentJob } = await admin
    .from("render_jobs")
    .select("status")
    .eq("id", jobId)
    .maybeSingle();
  if (currentJob?.status === "cancelled") return;

  const { data: items } = await admin
    .from("render_job_items")
    .select("status")
    .eq("job_id", jobId);
  const statuses = (items ?? []).map((item) => item.status as RenderJobItemStatus);
  const progress = computeProgress(statuses);
  const isTerminal = progress.total === 0 || progress.done >= progress.total;
  const now = new Date().toISOString();

  const status: RenderJobStatus = !isTerminal
    ? "processing"
    : progress.failed > 0
      ? "failed"
      : "completed";

  await admin
    .from("render_jobs")
    .update({
      status,
      completed_at: isTerminal ? now : null,
      error_message:
        isTerminal && progress.failed > 0
          ? `${progress.failed} item${progress.failed === 1 ? "" : "s"} failed`
          : null,
    })
    .eq("id", jobId);
}

export async function processRenderJob(jobId: string): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: claimed, error: claimError } = await admin
    .from("render_jobs")
    .update({
      status: "processing",
      started_at: now,
      error_message: null,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id, run_id")
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) return;

  try {
    const { data: items, error: itemsError } = await admin
      .from("render_job_items")
      .select("variant_id")
      .eq("job_id", jobId);
    if (itemsError) throw itemsError;

    const variantIds = (items ?? [])
      .map((item) => item.variant_id as string)
      .filter(Boolean);

    if (variantIds.length === 0) {
      await admin
        .from("render_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", jobId);
      return;
    }

    await renderRun(claimed.run_id as string, {
      variantIds,
      onVariantStatus: (event) => updateJobItemFromEvent(jobId, event),
    });

    await finalizeJob(jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedAt = new Date().toISOString();
    await admin
      .from("render_job_items")
      .update({
        status: "failed",
        completed_at: failedAt,
        last_error: message,
      })
      .eq("job_id", jobId)
      .in("status", ["queued", "rendering"]);
    await admin
      .from("render_jobs")
      .update({
        status: "failed",
        completed_at: failedAt,
        error_message: message,
      })
      .eq("id", jobId);
  }
}

export async function enqueueRenderJob(input: {
  runId: string;
  createdBy?: string | null;
  priority?: number;
}): Promise<{ job: RenderJob; created: boolean }> {
  const admin = createAdminClient();
  const priority = Math.max(1, Math.min(1000, Number(input.priority ?? 100)));

  const { data: existing, error: existingError } = await admin
    .from("render_jobs")
    .select("id")
    .eq("run_id", input.runId)
    .in("status", ACTIVE_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const job = await getRenderJobByIdAdmin(existing.id as string);
    if (!job) throw new Error("enqueueRenderJob: active job not found");
    if (job.status === "queued") {
      void processRenderJob(job.id).catch((error) => {
        console.error("[render-jobs] failed to process existing queued job", {
          jobId: job.id,
          error,
        });
      });
    }
    return { job, created: false };
  }

  const { data: runRow, error: runError } = await admin
    .from("variant_runs")
    .select("id")
    .eq("id", input.runId)
    .maybeSingle();
  if (runError) throw runError;
  if (!runRow) throw new Error(`Run ${input.runId} not found`);

  const { data: pendingRows, error: pendingError } = await admin
    .from("variants")
    .select("id")
    .eq("run_id", input.runId)
    .eq("status", "pending");
  if (pendingError) throw pendingError;

  const { data: createdJobRow, error: createJobError } = await admin
    .from("render_jobs")
    .insert({
      run_id: input.runId,
      priority,
      status: "queued",
      queued_at: new Date().toISOString(),
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (createJobError) throw createJobError;

  const jobId = createdJobRow.id as string;
  const pendingVariantIds = (pendingRows ?? [])
    .map((row) => row.id as string)
    .filter(Boolean);

  if (pendingVariantIds.length > 0) {
    const { error: itemsInsertError } = await admin
      .from("render_job_items")
      .insert(
        pendingVariantIds.map((variantId) => ({
          job_id: jobId,
          variant_id: variantId,
          status: "queued",
          attempts: 0,
        }))
      );
    if (itemsInsertError) throw itemsInsertError;
    void processRenderJob(jobId).catch((error) => {
      console.error("[render-jobs] failed to process newly queued job", {
        jobId,
        error,
      });
    });
  } else {
    await admin
      .from("render_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);
  }

  const job = await getRenderJobByIdAdmin(jobId);
  if (!job) throw new Error("enqueueRenderJob: created job not found");
  return { job, created: true };
}

export async function getRenderJobById(id: string): Promise<RenderJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("render_jobs")
    .select("*, render_job_items(status)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toRenderJob(data as RenderJobRow);
}

export async function listRenderJobsForRun(
  runId: string,
  opts?: { limit?: number }
): Promise<RenderJob[]> {
  const supabase = await createClient();
  const parsedLimit = Number(opts?.limit ?? 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(50, Math.trunc(parsedLimit)))
    : 10;
  const { data, error } = await supabase
    .from("render_jobs")
    .select("*, render_job_items(status)")
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => toRenderJob(row as RenderJobRow));
}
