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
const DEFAULT_DELIVERABLE_WORKFLOW_KEY = "deliverable_templating_v1";

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

export async function ensureDeliverableWorkflowInstance(input: {
  deliverableId: string;
  createdBy?: string | null;
}): Promise<WorkflowInstanceDetails> {
  const admin = createAdminClient();
  const { data: deliverableRow, error } = await admin
    .from("campaign_deliverables")
    .select("id, campaign_id")
    .eq("id", input.deliverableId)
    .maybeSingle();

  if (error || !deliverableRow) {
    throw new Error(`Deliverable ${input.deliverableId} not found`);
  }

  return ensureWorkflowInstance({
    entityType: "deliverable",
    entityId: input.deliverableId,
    campaignId: (deliverableRow.campaign_id as string | null) ?? null,
    createdBy: input.createdBy ?? null,
    definitionKey: DEFAULT_DELIVERABLE_WORKFLOW_KEY,
  });
}

// For a given Designer (actorId), returns the set of deliverable IDs that
// are "theirs" — either directly assigned via assigned_designer_id, or
// inherited via campaign_assignments.assignment_role='primary_designer'
// (when the deliverable has no explicit designer override).
async function listOwnedDeliverableIdsForDesigner(
  actorId: string
): Promise<string[]> {
  const admin = createAdminClient();

  const directPromise = admin
    .from("campaign_deliverables")
    .select("id")
    .eq("assigned_designer_id", actorId);

  const campaignPromise = admin
    .from("campaign_assignments")
    .select("campaign_id")
    .eq("user_id", actorId)
    .eq("assignment_role", "primary_designer");

  const [directRes, campaignRes] = await Promise.all([directPromise, campaignPromise]);

  if (directRes.error) throw directRes.error;
  if (campaignRes.error) throw campaignRes.error;

  const ids = new Set<string>();
  for (const row of directRes.data ?? []) ids.add(row.id as string);

  const campaignIds = (campaignRes.data ?? [])
    .map((r) => r.campaign_id as string)
    .filter(Boolean);

  if (campaignIds.length > 0) {
    const { data: inherited, error: inheritedErr } = await admin
      .from("campaign_deliverables")
      .select("id")
      .in("campaign_id", campaignIds)
      .is("assigned_designer_id", null);
    if (inheritedErr) throw inheritedErr;
    for (const row of inherited ?? []) ids.add(row.id as string);
  }

  return Array.from(ids);
}

async function fetchDeliverableQueueItems(input: {
  actorId: string;
  actorRole: UserRole;
  limit: number;
}): Promise<MyWorkQueueItem[]> {
  // Phase 1 scope: Designer sees their deliverables; Admin sees all;
  // other roles have no transitions on the deliverable workflow so they
  // get nothing.
  if (input.actorRole !== "Designer" && input.actorRole !== "Admin") {
    return [];
  }

  const admin = createAdminClient();

  let deliverableFilter: string[] | null = null;
  if (input.actorRole === "Designer") {
    deliverableFilter = await listOwnedDeliverableIdsForDesigner(input.actorId);
    if (deliverableFilter.length === 0) return [];
  }

  let query = admin
    .from("workflow_instances")
    .select("*")
    .eq("entity_type", "deliverable")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(input.limit);

  if (deliverableFilter) query = query.in("entity_id", deliverableFilter);

  const { data: instanceRows, error: instanceError } = await query;
  if (instanceError) throw instanceError;

  const instances = (instanceRows ?? []).map((row) => toWorkflowInstance(row as Row));
  if (instances.length === 0) return [];

  const defaultDefinition = await getActiveWorkflowDefinition({
    entityType: "deliverable",
    key: DEFAULT_DELIVERABLE_WORKFLOW_KEY,
  });

  const deliverableIds = Array.from(new Set(instances.map((i) => i.entityId)));

  const { data: deliverableRows, error: delError } = await admin
    .from("campaign_deliverables")
    .select(
      "id, campaign_id, channel, format, width, height, aspect_ratio, quantity, notes, assigned_designer_id, campaigns(id, wf_number, name, brand)"
    )
    .in("id", deliverableIds);

  if (delError) throw delError;

  const deliverableMap = new Map<string, Row>();
  for (const row of deliverableRows ?? []) {
    deliverableMap.set(row.id as string, row as Row);
  }

  // Fetch any existing template back-links so the card can link to the
  // editor directly when one already exists.
  const { data: templateRows, error: tmplError } = await admin
    .from("templates")
    .select("id, campaign_deliverable_id")
    .in("campaign_deliverable_id", deliverableIds);

  if (tmplError) throw tmplError;

  const templateByDeliverable = new Map<string, string>();
  for (const row of templateRows ?? []) {
    const key = row.campaign_deliverable_id as string | null;
    if (key) templateByDeliverable.set(key, row.id as string);
  }

  const instanceIds = instances.map((i) => i.id);
  const { data: eventRows, error: eventError } = await admin
    .from("workflow_events")
    .select("*")
    .in("instance_id", instanceIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(50, input.limit * 8));

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
    const availableTransitions = availableTransitionsForRole(
      defaultDefinition.transitions,
      instance.currentStage,
      input.actorRole
    );

    if (availableTransitions.length === 0) continue;

    const deliverable = deliverableMap.get(instance.entityId);
    if (!deliverable) continue;

    const campaign = deliverable.campaigns as Row | null | undefined;

    queue.push({
      workflowInstanceId: instance.id,
      entityType: "deliverable",
      entityId: instance.entityId,
      campaignId: (deliverable.campaign_id as string | null) ?? null,
      campaign: campaign
        ? {
            id: campaign.id as string,
            wfNumber: (campaign.wf_number as string) ?? "",
            name: (campaign.name as string) ?? "",
            brand: (campaign.brand as string | null) ?? null,
          }
        : null,
      asset: null,
      deliverable: {
        id: deliverable.id as string,
        channel: (deliverable.channel as string) ?? "",
        format: (deliverable.format as string) ?? "",
        width: Number(deliverable.width ?? 0),
        height: Number(deliverable.height ?? 0),
        aspectRatio: (deliverable.aspect_ratio as string) ?? "",
        quantity: Number(deliverable.quantity ?? 1),
        notes: (deliverable.notes as string) ?? "",
        assignedDesignerId: (deliverable.assigned_designer_id as string | null) ?? null,
        templateId: templateByDeliverable.get(deliverable.id as string) ?? null,
      },
      currentStage: instance.currentStage,
      stageQueueRoles: normalizeRoleArray(
        getQueueRolesForStage(defaultDefinition.stages, instance.currentStage)
      ),
      availableTransitions,
      recentEvents: eventsByInstance.get(instance.id) ?? [],
      updatedAt: instance.updatedAt,
    });
  }

  return queue;
}

async function fetchDamAssetQueueItems(input: {
  actorRole: UserRole;
  limit: number;
}): Promise<MyWorkQueueItem[]> {
  const admin = createAdminClient();

  const { data: instanceRows, error: instanceError } = await admin
    .from("workflow_instances")
    .select("*")
    .eq("entity_type", "dam_asset")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(input.limit);

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
    .limit(Math.max(50, input.limit * 8));

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
        status: asset.status as NonNullable<MyWorkQueueItem["asset"]>["status"],
        syncStatus: asset.sync_status as NonNullable<MyWorkQueueItem["asset"]>["syncStatus"],
        updatedAt: (asset.updated_at as string) ?? instance.updatedAt,
      },
      deliverable: null,
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

export async function listMyWorkQueue(input: {
  actorId: string;
  actorRole: UserRole;
  limit?: number;
}): Promise<MyWorkQueueItem[]> {
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit ?? 100)));

  const [damItems, deliverableItems] = await Promise.all([
    fetchDamAssetQueueItems({ actorRole: input.actorRole, limit }),
    fetchDeliverableQueueItems({
      actorId: input.actorId,
      actorRole: input.actorRole,
      limit,
    }),
  ]);

  return [...damItems, ...deliverableItems]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
    .slice(0, limit);
}
