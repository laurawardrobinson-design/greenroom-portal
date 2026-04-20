import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/deliverables/[id] — single deliverable with campaign + workflow context
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Designer",
      "Art Director",
      "Creative Director",
    ]);
    const { id } = await params;
    const db = createAdminClient();

    const { data, error } = await db
      .from("campaign_deliverables")
      .select(
        `id, campaign_id, channel, format, width, height, aspect_ratio,
         quantity, notes, assigned_vendor_id, assigned_designer_id,
         headline_override, cta_override, disclaimer_override, legal_override,
         campaigns(id, wf_number, name, brand, headline, cta, disclaimer, legal)`
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: wf } = await db
      .from("workflow_instances")
      .select("id, current_stage, status, updated_at")
      .eq("entity_type", "deliverable")
      .eq("entity_id", id)
      .maybeSingle();

    return NextResponse.json({
      id: data.id,
      campaignId: data.campaign_id,
      channel: data.channel,
      format: data.format,
      width: data.width,
      height: data.height,
      aspectRatio: data.aspect_ratio,
      quantity: data.quantity,
      notes: data.notes,
      assignedVendorId: data.assigned_vendor_id,
      assignedDesignerId: data.assigned_designer_id,
      headlineOverride: data.headline_override,
      ctaOverride: data.cta_override,
      disclaimerOverride: data.disclaimer_override,
      legalOverride: data.legal_override,
      campaign: data.campaigns ?? null,
      workflow: wf
        ? {
            id: wf.id,
            currentStage: wf.current_stage,
            status: wf.status,
            updatedAt: wf.updated_at,
          }
        : null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/deliverables/[id] — update vendor assignment or notes
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Creative Director"]);
    const { id } = await params;
    const body = await request.json();
    const db = createAdminClient();

    const updates: Record<string, unknown> = {};
    if ("assignedVendorId" in body) {
      updates.assigned_vendor_id = body.assignedVendorId ?? null;
    }
    if ("notes" in body) updates.notes = body.notes;
    if ("quantity" in body) updates.quantity = body.quantity;
    if ("headlineOverride" in body) updates.headline_override = body.headlineOverride;
    if ("ctaOverride" in body) updates.cta_override = body.ctaOverride;
    if ("disclaimerOverride" in body) updates.disclaimer_override = body.disclaimerOverride;
    if ("legalOverride" in body) updates.legal_override = body.legalOverride;

    const { data, error } = await db
      .from("campaign_deliverables")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/deliverables/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    const db = createAdminClient();

    const { error } = await db
      .from("campaign_deliverables")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
