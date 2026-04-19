import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import type {
  DamSyncJob,
  DamSyncJobItem,
  DamSyncJobStatus,
  UserRole,
} from "@/types/domain";
import {
  getExternalDamAdapter,
  type DamSyncAssetPayload,
  type DamSyncVersionPayload,
} from "./dam-sync-adapter";

type Row = Record<string, unknown>;

type DamSyncJobRow = Row & {
  dam_sync_job_items?: Row[];
};

export function buildDamSyncIdempotencyKey(
  damAssetId: string,
  damAssetVersionId: string
): string {
  return `dam_sync:${damAssetId}:version:${damAssetVersionId}`;
}

export function computeDamSyncBackoffSeconds(attempt: number): number {
  const normalizedAttempt = Math.max(1, Math.trunc(attempt));
  const seconds = 15 * 2 ** (normalizedAttempt - 1);
  return Math.min(900, seconds);
}

export function computeDamSyncNextAttemptAt(attempt: number): string {
  const waitSeconds = computeDamSyncBackoffSeconds(attempt);
  const next = new Date(Date.now() + waitSeconds * 1000);
  return next.toISOString();
}

function toDamSyncJobItem(row: Row): DamSyncJobItem {
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    damAssetId: row.dam_asset_id as string,
    damAssetVersionId: row.dam_asset_version_id as string,
    status: row.status as DamSyncJobStatus,
    attempts: Number(row.attempts ?? 0),
    nextAttemptAt: (row.next_attempt_at as string | null) ?? null,
    externalDamId: (row.external_dam_id as string | null) ?? null,
    syncedAt: (row.synced_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toDamSyncJob(row: DamSyncJobRow): DamSyncJob {
  return {
    id: row.id as string,
    damAssetId: row.dam_asset_id as string,
    latestVersionId: (row.latest_version_id as string | null) ?? null,
    idempotencyKey: (row.idempotency_key as string) ?? "",
    status: row.status as DamSyncJobStatus,
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    nextAttemptAt: (row.next_attempt_at as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    workerId: (row.worker_id as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    items: ((row.dam_sync_job_items as Row[] | undefined) ?? []).map(toDamSyncJobItem),
  };
}

async function getDamSyncJobByIdAdmin(jobId: string): Promise<DamSyncJob | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dam_sync_jobs")
    .select("*, dam_sync_job_items(*)")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  return toDamSyncJob(data as DamSyncJobRow);
}

async function resolveSyncVersion(input: {
  damAssetId: string;
  damAssetVersionId?: string | null;
}): Promise<{ id: string; versionNumber: number }> {
  const admin = createAdminClient();

  if (input.damAssetVersionId) {
    const { data, error } = await admin
      .from("dam_asset_versions")
      .select("id, version_number")
      .eq("id", input.damAssetVersionId)
      .eq("dam_asset_id", input.damAssetId)
      .maybeSingle();

    if (error || !data) {
      throw new Error("DAM version not found for asset");
    }

    return {
      id: data.id as string,
      versionNumber: Number(data.version_number ?? 0),
    };
  }

  const { data, error } = await admin
    .from("dam_asset_versions")
    .select("id, version_number")
    .eq("dam_asset_id", input.damAssetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No DAM version exists yet for this asset");
  }

  return {
    id: data.id as string,
    versionNumber: Number(data.version_number ?? 0),
  };
}

async function markDamAssetPendingSync(damAssetId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("dam_assets")
    .update({
      sync_status: "pending_sync",
      sync_error: "",
    })
    .eq("id", damAssetId);

  if (error) throw error;
}

export async function enqueueDamSyncJob(input: {
  damAssetId: string;
  damAssetVersionId?: string | null;
  createdBy?: string | null;
  actorRole?: UserRole | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  force?: boolean;
  processNow?: boolean;
}): Promise<{ job: DamSyncJob; created: boolean }> {
  const admin = createAdminClient();

  const version = await resolveSyncVersion({
    damAssetId: input.damAssetId,
    damAssetVersionId: input.damAssetVersionId,
  });

  const baseKey = buildDamSyncIdempotencyKey(input.damAssetId, version.id);
  const idempotencyKey = input.force ? `${baseKey}:force:${Date.now()}` : baseKey;

  if (!input.force) {
    const { data: existingRow } = await admin
      .from("dam_sync_jobs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingRow?.id) {
      const existing = await getDamSyncJobByIdAdmin(existingRow.id as string);
      if (existing) {
        if (existing.status === "queued") {
          void processDamSyncJob(existing.id).catch((error) => {
            console.error("[dam-sync] failed to process existing queued job", {
              jobId: existing.id,
              error,
            });
          });
        }
        return { job: existing, created: false };
      }
    }
  }

  const now = new Date().toISOString();

  const { data: jobRow, error: jobError } = await admin
    .from("dam_sync_jobs")
    .insert({
      dam_asset_id: input.damAssetId,
      latest_version_id: version.id,
      idempotency_key: idempotencyKey,
      status: "queued",
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: now,
      metadata: {
        ...(input.metadata ?? {}),
        reason: input.reason ?? null,
      },
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .maybeSingle();

  if (jobError || !jobRow) {
    throw jobError ?? new Error("Failed to enqueue DAM sync job");
  }

  const { error: itemError } = await admin.from("dam_sync_job_items").insert({
    job_id: jobRow.id,
    dam_asset_id: input.damAssetId,
    dam_asset_version_id: version.id,
    status: "queued",
    attempts: 0,
    next_attempt_at: now,
    payload: {
      versionNumber: version.versionNumber,
    },
  });

  if (itemError) throw itemError;

  await markDamAssetPendingSync(input.damAssetId);

  await logAuditEvent({
    actorId: input.createdBy ?? null,
    actorRole: input.actorRole ?? null,
    targetType: "dam_asset",
    targetId: input.damAssetId,
    action: "sync_enqueued",
    reason: input.reason ?? null,
    metadata: {
      jobId: jobRow.id,
      versionId: version.id,
      idempotencyKey,
    },
  });

  const createdJob = await getDamSyncJobByIdAdmin(jobRow.id as string);
  if (!createdJob) throw new Error("Queued DAM sync job could not be reloaded");

  if (input.processNow !== false) {
    void processDamSyncJob(createdJob.id).catch((error) => {
      console.error("[dam-sync] failed to process newly queued job", {
        jobId: createdJob.id,
        error,
      });
    });
  }

  return { job: createdJob, created: true };
}

async function claimDamSyncJobById(input: {
  jobId: string;
  workerId: string;
}): Promise<DamSyncJob | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: candidate, error: candidateError } = await admin
    .from("dam_sync_jobs")
    .select("*")
    .eq("id", input.jobId)
    .maybeSingle();

  if (candidateError || !candidate) return null;

  const status = candidate.status as DamSyncJobStatus;
  const attempts = Number(candidate.attempts ?? 0);
  const maxAttempts = Number(candidate.max_attempts ?? 5);
  const nextAttemptAt = (candidate.next_attempt_at as string | null) ?? null;

  if (!(["queued", "failed"] as DamSyncJobStatus[]).includes(status)) return null;
  if (attempts >= maxAttempts) return null;
  if (nextAttemptAt && nextAttemptAt > now) return null;

  const { data: claimedRow, error: claimError } = await admin
    .from("dam_sync_jobs")
    .update({
      status: "running",
      attempts: attempts + 1,
      started_at: now,
      worker_id: input.workerId,
      error_message: null,
      completed_at: null,
    })
    .eq("id", input.jobId)
    .eq("attempts", attempts)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle();

  if (claimError || !claimedRow) return null;

  const claimed = await getDamSyncJobByIdAdmin(claimedRow.id as string);
  return claimed;
}

async function claimNextDamSyncJob(input: {
  workerId: string;
}): Promise<DamSyncJob | null> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: candidates, error } = await admin
    .from("dam_sync_jobs")
    .select("id")
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(15);

  if (error) throw error;

  for (const candidate of candidates ?? []) {
    const claimed = await claimDamSyncJobById({
      jobId: candidate.id as string,
      workerId: input.workerId,
    });
    if (claimed) return claimed;
  }

  return null;
}

function toAssetPayload(row: Row): DamSyncAssetPayload {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    fileUrl: (row.file_url as string) ?? "",
    fileType: (row.file_type as string) ?? "",
    status: (row.status as string) ?? "ingested",
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    externalDamSystem: (row.external_dam_system as string) ?? "placeholder",
    externalDamId: (row.external_dam_id as string | null) ?? null,
  };
}

function toVersionPayload(row: Row): DamSyncVersionPayload {
  return {
    id: row.id as string,
    damAssetId: row.dam_asset_id as string,
    versionNumber: Number(row.version_number ?? 1),
    label: (row.label as string) ?? "",
    stage: (row.stage as string) ?? "ingested",
    fileUrl: (row.file_url as string) ?? "",
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    notes: (row.notes as string) ?? "",
    createdAt: row.created_at as string,
  };
}

async function processClaimedDamSyncJob(claimed: DamSyncJob): Promise<DamSyncJob> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: assetRow, error: assetError } = await admin
    .from("dam_assets")
    .select("*")
    .eq("id", claimed.damAssetId)
    .maybeSingle();

  if (assetError || !assetRow) {
    throw assetError ?? new Error("DAM asset not found for sync job");
  }

  const adapter = getExternalDamAdapter(
    (assetRow.external_dam_system as string | null | undefined) ?? "placeholder"
  );

  await logAuditEvent({
    actorId: null,
    actorRole: null,
    targetType: "dam_asset",
    targetId: claimed.damAssetId,
    action: "sync_started",
    metadata: {
      jobId: claimed.id,
      attempt: claimed.attempts,
      workerId: claimed.workerId,
    },
  });

  const failures: string[] = [];
  let externalDamId: string | null = null;

  for (const item of claimed.items) {
    const { data: versionRow, error: versionError } = await admin
      .from("dam_asset_versions")
      .select("*")
      .eq("id", item.damAssetVersionId)
      .eq("dam_asset_id", claimed.damAssetId)
      .maybeSingle();

    if (versionError || !versionRow) {
      const message = "DAM version missing for sync item";
      failures.push(message);
      await admin
        .from("dam_sync_job_items")
        .update({
          status: "failed",
          attempts: item.attempts + 1,
          last_error: message,
        })
        .eq("id", item.id);
      continue;
    }

    await admin
      .from("dam_sync_job_items")
      .update({
        status: "running",
        attempts: item.attempts + 1,
      })
      .eq("id", item.id);

    try {
      const result = await adapter.syncAssetVersion({
        asset: toAssetPayload(assetRow as Row),
        version: toVersionPayload(versionRow as Row),
        context: {
          jobId: claimed.id,
          jobItemId: item.id,
          idempotencyKey: `${claimed.idempotencyKey}:${item.id}`,
          attempt: claimed.attempts,
        },
      });

      externalDamId = result.externalDamId;

      await admin
        .from("dam_sync_job_items")
        .update({
          status: "succeeded",
          synced_at: result.syncedAt,
          external_dam_id: result.externalDamId,
          last_error: null,
          payload: {
            ...(item.payload ?? {}),
            syncResult: result.metadata ?? {},
          },
        })
        .eq("id", item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(message);
      await admin
        .from("dam_sync_job_items")
        .update({
          status: "failed",
          last_error: message,
        })
        .eq("id", item.id);
    }
  }

  if (failures.length === 0) {
    await admin
      .from("dam_sync_jobs")
      .update({
        status: "succeeded",
        completed_at: now,
        next_attempt_at: null,
        error_message: null,
      })
      .eq("id", claimed.id);

    await admin
      .from("dam_assets")
      .update({
        sync_status: "synced",
        last_synced_at: now,
        sync_error: "",
        external_dam_id: externalDamId ?? (assetRow.external_dam_id as string | null) ?? null,
      })
      .eq("id", claimed.damAssetId);

    await logAuditEvent({
      actorId: null,
      actorRole: null,
      targetType: "dam_asset",
      targetId: claimed.damAssetId,
      action: "sync_succeeded",
      metadata: {
        jobId: claimed.id,
        externalDamId,
      },
    });
  } else {
    const message = failures[0] ?? "DAM sync failed";
    const shouldRetry = claimed.attempts < claimed.maxAttempts;
    const nextAttemptAt = shouldRetry
      ? computeDamSyncNextAttemptAt(claimed.attempts)
      : null;

    await admin
      .from("dam_sync_jobs")
      .update({
        status: "failed",
        completed_at: shouldRetry ? null : now,
        next_attempt_at: nextAttemptAt,
        error_message: message,
      })
      .eq("id", claimed.id);

    await admin
      .from("dam_sync_job_items")
      .update({
        next_attempt_at: nextAttemptAt,
      })
      .eq("job_id", claimed.id)
      .eq("status", "failed");

    await admin
      .from("dam_assets")
      .update({
        sync_status: "error",
        sync_error: message,
      })
      .eq("id", claimed.damAssetId);

    await logAuditEvent({
      actorId: null,
      actorRole: null,
      targetType: "dam_asset",
      targetId: claimed.damAssetId,
      action: "sync_failed",
      metadata: {
        jobId: claimed.id,
        attempt: claimed.attempts,
        willRetry: shouldRetry,
        nextAttemptAt,
        error: message,
      },
    });
  }

  await reconcileDamAssetSyncState({ damAssetId: claimed.damAssetId });

  const refreshed = await getDamSyncJobByIdAdmin(claimed.id);
  if (!refreshed) throw new Error("Synced job could not be reloaded");
  return refreshed;
}

export async function processDamSyncJob(
  jobId: string,
  opts?: { workerId?: string }
): Promise<DamSyncJob | null> {
  const claimed = await claimDamSyncJobById({
    jobId,
    workerId: opts?.workerId ?? "dam-sync.worker",
  });

  if (!claimed) return null;
  return processClaimedDamSyncJob(claimed);
}

export async function processNextDamSyncJobs(opts?: {
  limit?: number;
  workerId?: string;
}): Promise<number> {
  const workerId = opts?.workerId ?? "dam-sync.worker";
  const limit = Math.max(1, Math.min(20, Math.trunc(opts?.limit ?? 1)));

  let processed = 0;
  while (processed < limit) {
    const claimed = await claimNextDamSyncJob({ workerId });
    if (!claimed) break;
    await processClaimedDamSyncJob(claimed);
    processed += 1;
  }

  return processed;
}

export async function listDamSyncJobs(filters?: {
  damAssetId?: string;
  status?: DamSyncJobStatus;
  limit?: number;
}): Promise<DamSyncJob[]> {
  const admin = createAdminClient();
  const limit = Math.max(1, Math.min(200, Math.trunc(filters?.limit ?? 50)));

  let query = admin
    .from("dam_sync_jobs")
    .select("*, dam_sync_job_items(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.damAssetId) query = query.eq("dam_asset_id", filters.damAssetId);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => toDamSyncJob(row as DamSyncJobRow));
}

export async function retryDamSyncJob(input: {
  jobId: string;
  actorId: string;
  actorRole: UserRole;
  reason?: string | null;
  processNow?: boolean;
}): Promise<DamSyncJob> {
  const existing = await getDamSyncJobByIdAdmin(input.jobId);
  if (!existing) throw new Error("Sync job not found");

  if (existing.status !== "failed" && existing.status !== "cancelled") {
    throw new Error("Only failed or cancelled sync jobs can be retried");
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: jobError } = await admin
    .from("dam_sync_jobs")
    .update({
      status: "queued",
      attempts: 0,
      next_attempt_at: now,
      started_at: null,
      completed_at: null,
      error_message: null,
      worker_id: null,
      metadata: {
        ...(existing.metadata ?? {}),
        retriedAt: now,
      },
    })
    .eq("id", input.jobId);

  if (jobError) throw jobError;

  const { error: itemsError } = await admin
    .from("dam_sync_job_items")
    .update({
      status: "queued",
      attempts: 0,
      next_attempt_at: now,
      synced_at: null,
      last_error: null,
      external_dam_id: null,
    })
    .eq("job_id", input.jobId);

  if (itemsError) throw itemsError;

  await markDamAssetPendingSync(existing.damAssetId);

  await logAuditEvent({
    actorId: input.actorId,
    actorRole: input.actorRole,
    targetType: "dam_asset",
    targetId: existing.damAssetId,
    action: "sync_retry_requested",
    reason: input.reason ?? null,
    metadata: {
      jobId: input.jobId,
    },
  });

  const refreshed = await getDamSyncJobByIdAdmin(input.jobId);
  if (!refreshed) throw new Error("Retried sync job could not be loaded");

  if (input.processNow !== false) {
    void processDamSyncJob(refreshed.id).catch((error) => {
      console.error("[dam-sync] failed to process retried job", {
        jobId: refreshed.id,
        error,
      });
    });
  }

  return refreshed;
}

export async function reconcileDamAssetSyncState(input: {
  damAssetId: string;
  actorId?: string | null;
  actorRole?: UserRole | null;
  reason?: string | null;
}): Promise<{
  syncStatus: "pending_sync" | "synced" | "stale" | "error";
  lastSyncedAt: string | null;
  syncError: string;
  externalDamId: string | null;
}> {
  const admin = createAdminClient();

  const { data: assetRow, error: assetError } = await admin
    .from("dam_assets")
    .select("id, external_dam_id")
    .eq("id", input.damAssetId)
    .maybeSingle();

  if (assetError || !assetRow) {
    throw assetError ?? new Error("DAM asset not found for reconcile");
  }

  const { data: latestVersion } = await admin
    .from("dam_asset_versions")
    .select("id, version_number")
    .eq("dam_asset_id", input.damAssetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestSucceededItem } = await admin
    .from("dam_sync_job_items")
    .select("dam_asset_version_id, synced_at, external_dam_id")
    .eq("dam_asset_id", input.damAssetId)
    .eq("status", "succeeded")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestVersionItem: Row | null = null;
  let latestVersionPendingCount = 0;

  if (latestVersion?.id) {
    const { data: versionItem } = await admin
      .from("dam_sync_job_items")
      .select("status, last_error, external_dam_id, synced_at")
      .eq("dam_asset_id", input.damAssetId)
      .eq("dam_asset_version_id", latestVersion.id as string)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestVersionItem = (versionItem as Row | null) ?? null;

    const { count: pendingCount } = await admin
      .from("dam_sync_job_items")
      .select("id", { count: "exact", head: true })
      .eq("dam_asset_id", input.damAssetId)
      .eq("dam_asset_version_id", latestVersion.id as string)
      .in("status", ["queued", "running"]);

    latestVersionPendingCount = pendingCount ?? 0;
  }

  let syncStatus: "pending_sync" | "synced" | "stale" | "error" = "pending_sync";
  let syncError = "";

  if (!latestVersion?.id) {
    syncStatus = "pending_sync";
  } else if (latestVersionPendingCount > 0) {
    syncStatus = "pending_sync";
  } else if (latestVersionItem?.status === "succeeded") {
    syncStatus = "synced";
  } else if (latestVersionItem?.status === "failed") {
    syncStatus = "error";
    syncError = (latestVersionItem.last_error as string) ?? "DAM sync failed";
  } else if (
    latestSucceededItem?.dam_asset_version_id &&
    (latestSucceededItem.dam_asset_version_id as string) !== (latestVersion.id as string)
  ) {
    syncStatus = "stale";
  } else if (latestSucceededItem?.dam_asset_version_id) {
    syncStatus = "synced";
  }

  const lastSyncedAt = (latestSucceededItem?.synced_at as string | null) ?? null;
  const externalDamId =
    (latestSucceededItem?.external_dam_id as string | null) ??
    ((assetRow.external_dam_id as string | null) ?? null);

  const { error: updateError } = await admin
    .from("dam_assets")
    .update({
      sync_status: syncStatus,
      last_synced_at: lastSyncedAt,
      sync_error: syncError,
      external_dam_id: externalDamId,
    })
    .eq("id", input.damAssetId);

  if (updateError) throw updateError;

  if (input.actorId || input.reason) {
    await logAuditEvent({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      targetType: "dam_asset",
      targetId: input.damAssetId,
      action: "sync_reconciled",
      reason: input.reason ?? null,
      metadata: {
        syncStatus,
        lastSyncedAt,
      },
    });
  }

  return {
    syncStatus,
    lastSyncedAt,
    syncError,
    externalDamId,
  };
}
