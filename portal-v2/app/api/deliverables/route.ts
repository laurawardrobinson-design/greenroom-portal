import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDeliverableWorkflowInstance } from "@/lib/services/workflow.service";

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const body = await request.json();
    const db = createAdminClient();

    const { data, error } = await db
      .from("campaign_deliverables")
      .insert({
        campaign_id: body.campaignId,
        channel: body.channel,
        format: body.format,
        width: body.width,
        height: body.height,
        aspect_ratio: body.aspectRatio,
        quantity: body.quantity || 1,
        notes: body.notes || "",
      })
      .select()
      .single();

    if (error) throw error;

    // If the campaign already has a primary_designer, this new deliverable
    // needs a templating task so it surfaces in the designer's My Work.
    const { data: hasDesigner } = await db
      .from("campaign_assignments")
      .select("id")
      .eq("campaign_id", body.campaignId)
      .eq("assignment_role", "primary_designer")
      .maybeSingle();

    if (hasDesigner) {
      try {
        await ensureDeliverableWorkflowInstance({
          deliverableId: data.id,
          createdBy: user.id,
        });
      } catch (wfError) {
        // Don't block deliverable creation on workflow wiring issues.
        console.error("Failed to create deliverable workflow instance:", wfError);
      }
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
