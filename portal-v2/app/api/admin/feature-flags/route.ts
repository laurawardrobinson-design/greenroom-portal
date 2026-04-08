import {
  WORKFLOW_FEATURE_FLAGS,
  type WorkflowFeatureFlagKey,
} from "@/lib/constants/feature-flags";
import { authErrorResponse, getAuthUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearWorkflowFeatureFlagCache,
  getWorkflowFeatureFlagSnapshot,
} from "@/lib/services/feature-flags.service";

function isWorkflowFeatureFlagKey(value: string): value is WorkflowFeatureFlagKey {
  return (WORKFLOW_FEATURE_FLAGS as readonly string[]).includes(value);
}

export async function GET() {
  try {
    const user = await getAuthUser();
    if (user.role !== "Admin") {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const flags = await getWorkflowFeatureFlagSnapshot();
    return Response.json({ flags });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthUser();
    if (user.role !== "Admin") {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = (await request.json()) as { key?: string; enabled?: unknown };
    if (!body.key || typeof body.enabled !== "boolean") {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!isWorkflowFeatureFlagKey(body.key)) {
      return Response.json({ error: "Unknown feature flag key" }, { status: 400 });
    }

    const db = createAdminClient();
    const { error } = await db.from("feature_flags").upsert(
      {
        key: body.key,
        enabled: body.enabled,
      },
      { onConflict: "key" }
    );

    if (error) {
      throw error;
    }

    clearWorkflowFeatureFlagCache();
    const flags = await getWorkflowFeatureFlagSnapshot();
    return Response.json({ flags });
  } catch (error) {
    return authErrorResponse(error);
  }
}
