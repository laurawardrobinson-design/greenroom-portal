import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditLogEvent, AuditTargetType } from "@/types/domain";

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toEvent(row: Record<string, unknown>): AuditLogEvent {
  const userRow = row.users as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    actorId: (row.actor_id as string | null) ?? null,
    actorRole: (row.actor_role as string | null) ?? null,
    actorName: (userRow?.name as string | undefined) ?? null,
    targetType: row.target_type as AuditTargetType,
    targetId: row.target_id as string,
    action: row.action as string,
    reason: (row.reason as string | null) ?? null,
    metadata:
      (row.metadata as Record<string, unknown>) ?? ({} as Record<string, unknown>),
    createdAt: row.created_at as string,
  };
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Append an audit event. Uses the admin client so background pipelines (render
 * worker, notification triggers) can log without a user session. When an actor
 * is known, pass actorId + actorRole — RLS insert policy expects the row's
 * actor_id to match auth.uid() for user-initiated writes, but the admin client
 * bypasses RLS for system writes.
 */
export async function logAuditEvent(params: {
  actorId: string | null;
  actorRole: string | null;
  targetType: AuditTargetType;
  targetId: string;
  action: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("asset_studio_audit_log").insert({
    actor_id: params.actorId,
    actor_role: params.actorRole,
    target_type: params.targetType,
    target_id: params.targetId,
    action: params.action,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });
  // Swallow: audit log must never block the primary action. Surface to server logs.
  if (error) {
    console.error("[audit-log] insert failed", {
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      error: error.message,
    });
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * List events for a single target, most recent first. Joins the actor's name
 * so the UI doesn't need a second round-trip.
 */
export async function listAuditEventsForTarget(
  targetType: AuditTargetType,
  targetId: string,
  limit = 100
): Promise<AuditLogEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_studio_audit_log")
    .select("*, users!asset_studio_audit_log_actor_id_fkey(name)")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toEvent);
}

/**
 * List events for a run AND its child variants — the run-detail feed needs both.
 * Two queries unioned client-side to keep indexes efficient.
 */
export async function listAuditEventsForRun(
  runId: string,
  variantIds: string[],
  limit = 200
): Promise<AuditLogEvent[]> {
  const supabase = await createClient();
  const runQ = supabase
    .from("asset_studio_audit_log")
    .select("*, users!asset_studio_audit_log_actor_id_fkey(name)")
    .eq("target_type", "variant_run")
    .eq("target_id", runId);
  const variantQ = variantIds.length
    ? supabase
        .from("asset_studio_audit_log")
        .select("*, users!asset_studio_audit_log_actor_id_fkey(name)")
        .eq("target_type", "variant")
        .in("target_id", variantIds)
    : null;
  const [runRes, variantRes] = await Promise.all([
    runQ,
    variantQ ?? Promise.resolve({ data: [], error: null } as const),
  ]);
  if (runRes.error) throw runRes.error;
  if (variantRes.error) throw variantRes.error;
  const merged = [...(runRes.data ?? []), ...(variantRes.data ?? [])]
    .map(toEvent)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
  return merged;
}
