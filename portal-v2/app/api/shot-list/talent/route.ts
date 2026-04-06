import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listCampaignTalent,
  getNextTalentNumber,
  addTalentToShot,
  updateTalent,
  removeTalentFromShot,
} from "@/lib/services/shot-list.service";

// GET /api/shot-list/talent?campaignId=xxx
export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }
    const talent = await listCampaignTalent(campaignId);
    return NextResponse.json(talent);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/shot-list/talent — add talent to shot
export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const body = await request.json();
    const { shotId, campaignId, talentNumber, ...fields } = body;
    if (!shotId || !campaignId) {
      return NextResponse.json({ error: "shotId and campaignId required" }, { status: 400 });
    }
    // Auto-assign next number if not provided
    const num = talentNumber || await getNextTalentNumber(campaignId);
    const talent = await addTalentToShot({ shotId, campaignId, talentNumber: num, ...fields });
    return NextResponse.json(talent, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/shot-list/talent — update talent entry
export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const body = await request.json();
    const { id, ...fields } = body;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const talent = await updateTalent(id, fields);
    return NextResponse.json(talent);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// DELETE /api/shot-list/talent?id=xxx
export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await removeTalentFromShot(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
