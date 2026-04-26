import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import {
  getBriefByCampaignId,
  upsertBrief,
  type CampaignBriefInput,
} from "@/lib/services/campaign-briefs.service";
import { createAdminClient } from "@/lib/supabase/admin";

const WRITE_ROLES = ["Admin", "Producer", "Post Producer", "Brand Marketing Manager"] as const;

async function assertWritable(campaignId: string, userId: string, role: string) {
  if (role !== "Brand Marketing Manager") {
    if (!WRITE_ROLES.includes(role as any)) {
      throw new AuthError("Insufficient permissions", 403);
    }
    return;
  }
  // BMM must own the campaign to write.
  const db = createAdminClient();
  const { data } = await db
    .from("campaigns")
    .select("brand_owner_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!data || data.brand_owner_id !== userId) {
    throw new AuthError("Not the brand owner on this campaign", 403);
  }
}

// GET /api/campaign-briefs/[campaignId] — returns brief or null.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { campaignId } = await params;
    const brief = await getBriefByCampaignId(campaignId);
    return NextResponse.json(brief);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PUT /api/campaign-briefs/[campaignId] — upsert brief, record version row.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const user = await getAuthUser();
    const { campaignId } = await params;
    await assertWritable(campaignId, user.id, user.role);

    const body = (await request.json()) as Partial<CampaignBriefInput>;
    const input: CampaignBriefInput = {
      objective: body.objective ?? "",
      audience: body.audience ?? "",
      proposition: body.proposition ?? "",
      mandatories: body.mandatories ?? "",
      successMeasure: body.successMeasure ?? "",
      references: Array.isArray(body.references)
        ? body.references.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
        : [],
    };

    const brief = await upsertBrief(campaignId, input, user.id);
    return NextResponse.json(brief);
  } catch (error) {
    return authErrorResponse(error);
  }
}
