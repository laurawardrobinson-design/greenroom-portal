import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import {
  listDriveCheckoutSessions,
  createDriveCheckoutSession,
  suggestDrivePair,
} from "@/lib/services/post-workflow.service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { searchParams } = new URL(req.url);

    // ?suggest=true&size=2+TB → return drive pair suggestion
    if (searchParams.get("suggest") === "true") {
      const size = searchParams.get("size") ?? "";
      const pair = await suggestDrivePair(size);
      return NextResponse.json(pair);
    }

    const sessions = await listDriveCheckoutSessions({
      status: searchParams.get("status") ?? undefined,
    });
    return NextResponse.json(sessions);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await req.json();
    const { campaignId, projectDisplayName, shootDate, expectedReturnDate, notes, drives } = body;
    if (!drives || drives.length !== 2) {
      return NextResponse.json({ error: "Exactly 2 drives required" }, { status: 400 });
    }
    const session = await createDriveCheckoutSession({
      campaignId: campaignId ?? null,
      projectDisplayName: projectDisplayName ?? null,
      shootDate: shootDate ?? null,
      expectedReturnDate: expectedReturnDate ?? null,
      checkedOutBy: user.id,
      notes: notes ?? null,
      drives,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
