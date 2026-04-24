import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import {
  getUserCampaignPreferences,
  upsertUserCampaignPreferences,
} from "@/lib/services/shot-list.service";
import type { ShotListDensity } from "@/types/domain";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id: campaignId } = await params;
    const prefs = await getUserCampaignPreferences(user.id, campaignId);
    // Default — don't 404, return a synthetic default prefs row
    return NextResponse.json(
      prefs ?? {
        id: null,
        userId: user.id,
        campaignId,
        shotListDensity: "detailed",
        createdAt: null,
        updatedAt: null,
      }
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id: campaignId } = await params;
    const body = (await request.json()) as {
      shotListDensity?: ShotListDensity;
    };

    if (body.shotListDensity && !["detailed", "on_set"].includes(body.shotListDensity)) {
      return NextResponse.json({ error: "Invalid density" }, { status: 400 });
    }

    const prefs = await upsertUserCampaignPreferences(user.id, campaignId, {
      shotListDensity: body.shotListDensity,
    });
    return NextResponse.json(prefs);
  } catch (error) {
    return authErrorResponse(error);
  }
}
