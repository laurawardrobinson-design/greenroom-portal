export interface WorkflowStageRule {
  key: string;
  label: string;
  queueRoles: string[];
}

export type WorkflowTransitionKind = "advance" | "return" | "reject";

export interface WorkflowTransitionRule {
  action: string;
  label: string;
  kind: WorkflowTransitionKind;
  from: string;
  to: string;
  roles: string[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized) continue;
    out.push(normalized);
  }
  return Array.from(new Set(out));
}

export function normalizeWorkflowStages(raw: unknown): WorkflowStageRule[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowStageRule[] = [];

  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    const key = asString(row.key);
    const label = asString(row.label) || key;
    if (!key) continue;
    out.push({
      key,
      label,
      queueRoles: asStringArray(row.queueRoles),
    });
  }

  return out;
}

export function normalizeWorkflowTransitions(raw: unknown): WorkflowTransitionRule[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowTransitionRule[] = [];

  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;

    const action = asString(row.action);
    const from = asString(row.from);
    const to = asString(row.to);
    if (!action || !from || !to) continue;

    const kindRaw = asString(row.kind);
    const kind: WorkflowTransitionKind =
      kindRaw === "return" || kindRaw === "reject" ? kindRaw : "advance";

    out.push({
      action,
      from,
      to,
      kind,
      label: asString(row.label) || action,
      roles: asStringArray(row.roles),
    });
  }

  return out;
}

export function listAvailableWorkflowTransitions(
  transitions: WorkflowTransitionRule[],
  currentStage: string,
  actorRole: string
): WorkflowTransitionRule[] {
  return transitions.filter(
    (transition) =>
      transition.from === currentStage &&
      transition.roles.includes(actorRole)
  );
}

export function resolveWorkflowTransition(input: {
  transitions: WorkflowTransitionRule[];
  currentStage: string;
  actorRole: string;
  action?: string | null;
  toStage?: string | null;
}):
  | { ok: true; transition: WorkflowTransitionRule }
  | { ok: false; reason: string } {
  const requestedAction = asString(input.action ?? "");
  const requestedStage = asString(input.toStage ?? "");

  const fromStageTransitions = input.transitions.filter(
    (transition) => transition.from === input.currentStage
  );

  if (fromStageTransitions.length === 0) {
    return {
      ok: false,
      reason: `No transitions are configured from stage ${input.currentStage}`,
    };
  }

  let candidates = fromStageTransitions;
  if (requestedAction) {
    candidates = candidates.filter((transition) => transition.action === requestedAction);
  }
  if (requestedStage) {
    candidates = candidates.filter((transition) => transition.to === requestedStage);
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: requestedAction
        ? `Action ${requestedAction} is not valid from stage ${input.currentStage}`
        : requestedStage
          ? `Stage ${requestedStage} is not reachable from ${input.currentStage}`
          : `No transition matched the request from ${input.currentStage}`,
    };
  }

  const roleMatched = candidates.find((transition) =>
    transition.roles.includes(input.actorRole)
  );

  if (!roleMatched) {
    return {
      ok: false,
      reason: `Role ${input.actorRole} cannot move stage ${input.currentStage}`,
    };
  }

  return { ok: true, transition: roleMatched };
}

export function getQueueRolesForStage(
  stages: WorkflowStageRule[],
  stageKey: string
): string[] {
  const stage = stages.find((candidate) => candidate.key === stageKey);
  return stage?.queueRoles ?? [];
}
