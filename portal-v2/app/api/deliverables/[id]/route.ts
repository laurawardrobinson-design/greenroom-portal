import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

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
