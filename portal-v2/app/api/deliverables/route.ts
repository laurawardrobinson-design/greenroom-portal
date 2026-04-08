import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
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
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
