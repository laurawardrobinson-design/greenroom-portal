import { describe, expect, it } from "vitest";
import {
  listAvailableWorkflowTransitions,
  normalizeWorkflowTransitions,
  resolveWorkflowTransition,
} from "@/lib/services/workflow.logic";

const transitions = normalizeWorkflowTransitions([
  {
    action: "start_retouching",
    label: "Start retouching",
    kind: "advance",
    from: "ingested",
    to: "retouching",
    roles: ["Admin", "Producer"],
  },
  {
    action: "mark_retouched",
    label: "Mark retouched",
    kind: "advance",
    from: "retouching",
    to: "retouched",
    roles: ["Admin", "Designer", "Post Producer"],
  },
  {
    action: "return_to_retouching",
    label: "Return to retouching",
    kind: "return",
    from: "retouched",
    to: "retouching",
    roles: ["Admin", "Art Director"],
  },
]);

describe("workflow.logic", () => {
  it("resolves a transition when stage/action/role are valid", () => {
    const resolved = resolveWorkflowTransition({
      transitions,
      currentStage: "ingested",
      actorRole: "Producer",
      action: "start_retouching",
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.transition.to).toBe("retouching");
  });

  it("rejects transitions for disallowed roles", () => {
    const resolved = resolveWorkflowTransition({
      transitions,
      currentStage: "ingested",
      actorRole: "Designer",
      action: "start_retouching",
    });

    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.reason).toContain("cannot move");
  });

  it("rejects invalid action from current stage", () => {
    const resolved = resolveWorkflowTransition({
      transitions,
      currentStage: "ingested",
      actorRole: "Admin",
      action: "mark_retouched",
    });

    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.reason).toContain("not valid");
  });

  it("lists only transitions available to a role at a stage", () => {
    const availableForAdmin = listAvailableWorkflowTransitions(
      transitions,
      "retouched",
      "Admin"
    );
    const availableForProducer = listAvailableWorkflowTransitions(
      transitions,
      "retouched",
      "Producer"
    );

    expect(availableForAdmin).toHaveLength(1);
    expect(availableForAdmin[0]?.action).toBe("return_to_retouching");
    expect(availableForProducer).toHaveLength(0);
  });
});
