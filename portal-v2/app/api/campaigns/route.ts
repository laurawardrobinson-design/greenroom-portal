import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listCampaigns, createCampaign } from "@/lib/services/campaigns.service";
import { createCampaignSchema } from "@/lib/validation/campaigns.schema";
import type { CampaignStatus } from "@/types/domain";

// GET /api/campaigns — list all campaigns (enriched with shoot/vendor counts)
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as CampaignStatus | null;
    const search = searchParams.get("search") || undefined;
    const mine = searchParams.get("mine") === "true";

    const campaigns = await listCampaigns({
      status: status || undefined,
      search,
      vendorId: user.vendorId || undefined,
      userId: user.id,
      role: user.role,
      createdBy: mine ? user.id : undefined,
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/campaigns — create a campaign
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await request.json();
    const parsed = createCampaignSchema.parse(body);
    const campaign = await createCampaign(parsed, user.id);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as any;
      const fieldErrors = zodError.errors?.reduce((acc: Record<string, string>, err: any) => {
        const path = err.path?.join(".") || "unknown";
        acc[path] = err.message;
        return acc;
      }, {}) || {};
      return NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 }
      );
    }
    return authErrorResponse(error);
  }
}
