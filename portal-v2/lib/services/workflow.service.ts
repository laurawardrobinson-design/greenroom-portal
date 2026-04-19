import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/services/audit-log.service";
import type {
  MyWorkQueueItem,
  UserRole,
  WorkflowDefinition,
  WorkflowEntityType,
  WorkflowEvent,
  WorkflowInstance,
  WorkflowInstanceDetails,
  WorkflowStage,
  WorkflowTransition,
} from "@/types/domain";
import {
  getQueueRolesForStage,
  normalizeWorkflowStages,
  normalizeWorkflowTransitions,
  resolveWorkflowTransition,
} from "./workflow.logic";

const KNOWN_USER_ROLES: UserRole[] = [
  "Admin",
  "Producer",
  "Studio",
  "Vendor",
  "Art Director",
  "Post Producer",
  "Designer",
];

const DEFAULT_DAM_WORKFLOW_KEY = "dam_asset_lifecycle_v1";

type Row = Record<string, unknown>;

type InstanceRow = Row & {
  workflow_definitions?: Row | null;
};

function isUserRole(value: string): value is UserRole {
  return (KNOWN_USER_ROLES as string[]).includes(value);
}

function normalizeRole(role: unknown): UserRole | null {
  if (typeof role !== "string") return null;
  return isUserRole(role) ? role : null;
}

function normalizeRoleArray(values: string[]): UserRole[] {
  const out: UserRole[] = [];
  for (const role of values) {
    if (!isUserRole(role)) continue;
    out.push(role);
  }
  return Array.from(new Set(out));
}

function availableTransitionsForRole(
  transitions: WorkflowTransition[],
  currentStage: string,
  actorRole?: UserRole
): WorkflowTransition[] {
  if (!actorRole) return [];
  return transitions.filter(
    (transition) =>
      transition.from === currentStage &&
      transition.roles.includes(actorRole)
  );
}

function toWorkflowDefinition(row: Row): WorkflowDefinition {
  const stages = normalizeWorkflowStages(row.stages).map<WorkflowStage>((stage) => ({
    key: stage.key,
    label: stage.label,
    queueRoles: normalizeRoleArray(stage.queueRoles),
  }));

  const transitions = normalizeWorkflowTransitions(row.transitions).map<WorkflowTransition>(
    (transition) => ({
      action: transition.action,
      label: transition.label,
      kind: transition.kind,
      from: transition.from,
      to: transition.to,
      roles: normalizeRoleArray(transition.roles),
    })
  );

  return {
    id: row.id as string,
    key: row.key as string,
    entityType: row.entity_type as WorkflowEntityType,
    name: (row.name as string) ?? "",
    version: Number(row.version ?? 1),
    description: (row.description as string) ?? "",
    initialStage: (row.initial_stage as string) ?? "",
    stages,
    transitions,
    isActive: Boolean(row.is_active),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toWorkflowInstance(row: Row): WorkflowInstance {
  return {
    id: row.id as string,
    definitionId: (row.definition_id as string | null) ?? null,
    entityType: row.entity_type as WorkflowEntityType,
    entityId: row.entity_id as string,
    campaignId: (row.campaign_id as string | null) ?? null,
    currentStage: (row.current_stage as string) ?? "",
    status: row.status as WorkflowInstance["status"],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    lastEventAt: row.last_event_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toWorkflowEvent(row: Row): WorkflowEvent {
  return {
    id: row.id as string,
    instanceId: row.instance_id as string,
    definitionId: (row.definition_id as string | null) ?? null,
    entityType: row.entity_type as WorkflowEntityType,
    entityId: row.entity_id as string,
    fromStage: (row.from_stage as string | null) ?? null,
    toStage: row.to_stage as string,
    action: (row.action as string) ?? "",
    actorId: (row.actor_id as string | null) ?? null,
    actorRole: normalizeRole(row.actor_role),
    reason: (row.reason as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  };
}

async function getActiveWorkflowDefinition(input: {
  entityType: WorkflowEntityType;
  key?: string;
}): Promise<WorkflowDefinition> {
  const admin = createAdminClient();

  let query = admin
    .from("workflow_definitions")
    .select("*")
    .eq("entity_type", input.entityType)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1);

  if (input.key) query = query.eq("key", input.key);

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    throw new Error(`No active workflow definition found for ${input.entityType}`);
  }

  return toWorkflowDefinition(data as Row);
}

async function getWorkflowInstanceRowByEntity(input: {
  entityType: WorkflowEntityType;
  entityId: string;
}): Promise<InstanceRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workflow_instances")
    .select("*, workflow_definitions(*)")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .maybeSingle();

  if (error || !data) return null;
  return data as InstanceRow;
}

async function getDamAssetLifecycleSnapshot(damAssetId: string): Promise<{
  stage: string;
  campaignId: string | null;
}> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dam_assets")
    .select("status, campaign_id")
    .eq("id", damAssetId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`DAM asset ${damAssetId} not found`);
  }

  return {
    stage: (data.status as string) ?? "ingested",
    campaignId: (data.campaign_id as string | null) ?? null,
  };
}

async function listWorkflowEventsByInstanceId(
  instanceId: string,
  limit = 100
): Promise<WorkflowEvent[]> {
  const admin = createAdminClient();
  const capped = Math.max(1, Math.min(500, Math.trunc(limit)));
  const { data, error } = await admin
    .from("workflow_events")
    .select("*")
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: false })
    .limit(capped);

  if (error) throw error;
  return (data ?? []).map((row) => toWorkflowEvent(row as Row));
}

function buildWorkflowInstanceDetails(input: {
  instance: WorkflowInstance;
  definition: WorkflowDefinition;
  events: WorkflowEvent[];
  actorRole?: UserRole;
}): WorkflowInstanceDetails {
  return {
    instance: input.instance,
    definition: input.definition,
    events: input.events,
    availableTransitions: availableTransitionsForRole(
      input.definition.transitions,
      input.instance.currentStage,
      input.actorRole
    ),
  };
}

export async function ensureWorkflowInstance(input: {
  entityType: WorkflowEntityType;
  entityId: string;
  createdBy?: string | null;
  initialStage?: string | null;
  campaignId?: string | null;
  definitionKey?: string;
}): Promise<WorkflowInstanceDetails> {
  const existing = await getWorkflowInstanceRowByEntity({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  if (existing) {
    const instance = toWorkflowInstance(existing);
    const definition = existing.workflow_definitions
      ? toWorkflowDefinition(existing.workflow_definitions)
      : await getActiveWorkflowDefinition({
          entityType: input.entityType,
          key: input.definitionKey,
        });

    const events = await listWorkflowEventsByInstanceId(instance.id);
    return buildWorkflowInstanceDetails({ instance, definition, events });
  }

  const definition = await getActiveWorkflowDefinition({
    entityType: input.entityType,
    key: input.definitionKey,
  });

  let initialStage = input.initialStage ?? definition.initialStage;
  let campaignId = input.campaignId ?? null;

  if (input.entityType === "dam_asset") {
    const snapshot = await getDamAssetLifecycleSnapshot(input.entityId);
    initialStage = input.initialStage ?? snapshot.stage;
    campaignId = input.campaignId ?? snapshot.campaignId;
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: insertedInstance, error: insertError } = await admin
    .from("workflow_instances")
    .insert({
      definition_id: definition.id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      campaign_id: campaignId,
      current_stage: initialStage,
      status: initialStage === "archived" ? "completed" : "active",
      metadata: {
        created_from: "ensure_workflow_instance",
      },
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
      last_event_at: now,
    })
    .select("*")
    .maybeSingle();

  if (insertError || !insertedInstance) {
    throw insertError ?? new Error("Failed to create workflow instance");
  }

  const instance = toWorkflowInstance(insertedInstance as Row);

  await admin.from("workflow_events").insert({
    instance_id: instance.id,
    definition_id: definition.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    from_stage: null,
    to_stage: initialStage,
    action: "created",
    actor_id: input.createdBy ?? null,
    actor_role: null,
    reason: "Workflow instance created",
    metadata: {
      source: "ensure_workflow_instance",
    },
  });

  const events = await listWorkflowEventsByInstanceId(instance.id);
  return buildWorkflowInstanceDetails({ instance, definition, events });
}

export async function getWorkflowInstanceDetails(input: {
  entityType: WorkflowEntityType;
  entityId: string;
  actorRole?: UserRole;
  ensureExists?: boolean;
  eventLimit?: number;
}): Promise<WorkflowInstanceDetails | null> {
  const instanceRow = await getWorkflowInstanceRowByEntity({
    entityType: input.entityType,
    entityId: input.entityId,
  });

  if (!instanceRow) {
    if (!input.ensureExists) return null;
    const created = await ensureWorkflowInstance({
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return {
      ...created,
      availableTransitions: availableTransitionsForRole(
        created.definition.transitions,
        created.instance.currentStage,
        input.actorRole
      ),
    };
  }

  const instance = toWorkflowInstance(instanceRow);
  const definition = instanceRow.workflow_definitions
    ? toWorkflowDefinition(instanceRow.workflow_definitions)
    : await getActiveWorkflowDefinition({ entityType: input.entityType });
  const events = await listWorkflowEventsByInstanceId(
    instance.id,
    input.eventLimit ?? 100
  );

  return buildWorkflowInstanceDetails({
    instance,
    definition,
    events,
    actorRole: input.actorRole,
  });
}

export async function advanceWorkflowTransition(input: {
  entityType: WorkflowEntityType;
  entityId: string;
  action?: string | null;
  toStage?: string | null;
  actorId: string;
  actorRole: UserRole;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<WorkflowInstanceDetails> {
  const details = await ensureWorkflowInstance({
    entityType: input.entityType,
    entityId: input.entityId,
    createdBy: input.actorId,
  });

  const resolution = resolveWorkflowTransition({
    transitions: details.definition.transitions,
    currentStage: details.instance.currentStage,
    actorRole: input.actorRole,
    action: input.action,
    toStage: input.toStage,
  });

  if (!resolution.ok) {
    throw new Error(resolution.reason);
  }

  const selected = resolution.transition;
  const now = new Date().toISOString();
  const admin = createAdminClient();

  if (input.entityType === "dam_asset") {
    const { error: damError } = await admin
      .from("dam_assets")
      .update({ status: selected.to })
      .eq("id", input.entityId);

    if (damError) throw damError;
  }

  const { data: updatedInstance, error: instanceUpdateError } = await admin
    .from("workflow_instances")
    .update({
      current_stage: selected.to,
      status: selected.to === "archived" ? "completed" : "active",
      updated_by: input.actorId,
      last_event_at: now,
    })
    .eq("id", details.instance.id)
    .eq("current_stage", details.instance.currentStage)
    .select("*")
    .maybeSingle();

  if (instanceUpdateError || !updatedInstance) {
    throw (
      instanceUpdateError ??
      new Error("Workflow instance changed before transition could be applied")
    );
  }

  const { error: eventError } = await admin.from("workflow_events").insert({
    instance_id: details.instance.id,
    definition_id: details.definition.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    from_stage: details.instance.currentStage,
    to_stage: selected.to,
    action: selected.action,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    reason: input.reason ?? null,
    metadata: {
      ...(input.metadata ?? {}),
      transitionKind: selected.kind,
      transitionLabel: selected.label,
    },
  });

  if (eventError) throw eventError;

  await logAuditEvent({
    actorId: input.actorId,
    actorRole: input.actorRole,
    targetType: "dam_asset",
    targetId: input.entityId,
    action: `workflow_transition:${selected.action}`,
    reason: input.reason ?? null,
    metadata: {
      from: details.instance.currentStage,
      to: selected.to,
      entityType: input.entityType,
    },
  });

  const refreshed = await getWorkflowInstanceDetails({
    entityType: input.entityType,
    entityId: input.entityId,
    actorRole: input.actorRole,
    ensureExists: true,
  });

  if (!refreshed) {
    throw new Error("Workflow transition completed but no instance was returned");
  }

  return refreshed;
}

export async function syncWorkflowStageFromEntityStatus(input: {
  entityType: WorkflowEntityType;
  entityId: string;
  stage: string;
  actorId?: string | null;
  actorRole?: UserRole | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const details = await ensureWorkflowInstance({
    entityType: input.entityType,
    entityId: input.entityId,
    createdBy: input.actorId ?? null,
    initialStage: input.stage,
    definitionKey: input.entityType === "dam_asset" ? DEFAULT_DAM_WORKFLOW_KEY : undefined,
  });

  if (details.instance.currentStage === input.stage) return;

  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("workflow_instances")
    .update({
      current_stage: input.stage,
      status: input.stage === "archived" ? "completed" : "active",
      updated_by: input.actorId ?? null,
      last_event_at: now,
    })
    .eq("id", details.instance.id);

  if (updateError) throw updateError;

  const { error: eventError } = await admin.from("workflow_events").insert({
    instance_id: details.instance.id,
    definition_id: details.definition.id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    from_stage: details.instance.currentStage,
    to_stage: input.stage,
    action: "status_synced",
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole ?? null,
    reason: input.reason ?? "Synchronized to entity lifecycle state",
    metadata: input.metadata ?? {},
  });

  if (eventError) throw eventError;
}

export async function listMyWorkQueue(input: {
  actorRole: UserRole;
  limit?: number;
}): Promise<MyWorkQueueItem[]> {
  const admin = createAdminClient();
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit ?? 100)));

  const { data: instanceRows, error: instanceError } = await admin
    .from("workflow_instances")
    .select("*")
    .eq("entity_type", "dam_asset")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (instanceError) throw instanceError;

  const instances = (instanceRows ?? []).map((row) => toWorkflowInstance(row as Row));
  if (instances.length === 0) return [];

  const definitionIds = Array.from(
    new Set(
      instances
        .map((instance) => instance.definitionId)
        .filter((value): value is string => Boolean(value))
    )
  );

  const definitionMap = new Map<string, WorkflowDefinition>();

  if (definitionIds.length > 0) {
    const { data: definitionRows, error: definitionError } = await admin
      .from("workflow_definitions")
      .select("*")
      .in("id", definitionIds);

    if (definitionError) throw definitionError;

    for (const row of definitionRows ?? []) {
      const definition = toWorkflowDefinition(row as Row);
      definitionMap.set(definition.id, definition);
    }
  }

  const defaultDefinition = await getActiveWorkflowDefinition({
    entityType: "dam_asset",
    key: DEFAULT_DAM_WORKFLOW_KEY,
  });

  const assetIds = Array.from(new Set(instances.map((instance) => instance.entityId)));

  const { data: assetRows, error: assetError } = await admin
    .from("dam_assets")
    .select("id, name, status, sync_status, updated_at, campaign_id, campaigns(id, wf_number, name, brand)")
    .in("id", assetIds);

  if (assetError) throw assetError;

  const assetMap = new Map<string, Row>();
  for (const row of assetRows ?? []) {
    assetMap.set(row.id as string, row as Row);
  }

  const instanceIds = instances.map((instance) => instance.id);
  const { data: eventRows, error: eventError } = await admin
    .from("workflow_events")
    .select("*")
    .in("instance_id", instanceIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(50, limit * 8));

  if (eventError) throw eventError;

  const eventsByInstance = new Map<string, WorkflowEvent[]>();
  for (const row of eventRows ?? []) {
    const event = toWorkflowEvent(row as Row);
    const list = eventsByInstance.get(event.instanceId) ?? [];
    if (list.length < 5) list.push(event);
    eventsByInstance.set(event.instanceId, list);
  }

  const queue: MyWorkQueueItem[] = [];

  for (const instance of instances) {
    const definition =
      (instance.definitionId ? definitionMap.get(instance.definitionId) : null) ??
      defaultDefinition;

    const availableTransitions = availableTransitionsForRole(
      definition.transitions,
      instance.currentStage,
      input.actorRole
    );

    if (availableTransitions.length === 0) continue;

    const asset = assetMap.get(instance.entityId);
    if (!asset) continue;

    const campaign = asset.campaigns as Row | null | undefined;

    queue.push({
      workflowInstanceId: instance.id,
      entityType: "dam_asset",
      entityId: instance.entityId,
      campaignId: (asset.campaign_id as string | null) ?? null,
      campaign: campaign
        ? {
            id: campaign.id as string,
            wfNumber: (campaign.wf_number as string) ?? "",
            name: (campaign.name as string) ?? "",
            brand: (campaign.brand as string | null) ?? null,
          }
        : null,
      asset: {
        id: asset.id as string,
        name: (asset.name as string) ?? "",
        status: asset.status as MyWorkQueueItem["asset"]["status"],
        syncStatus: asset.sync_status as MyWorkQueueItem["asset"]["syncStatus"],
        updatedAt: (asset.updated_at as string) ?? instance.updatedAt,
      },
      currentStage: instance.currentStage,
      stageQueueRoles: normalizeRoleArray(
        getQueueRolesForStage(definition.stages, instance.currentStage)
      ),
      availableTransitions,
      recentEvents: eventsByInstance.get(instance.id) ?? [],
      updatedAt: instance.updatedAt,
    });
  }

  return queue;
}
