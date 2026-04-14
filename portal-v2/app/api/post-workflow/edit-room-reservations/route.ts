import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import {
  listEditRoomReservations,
  createEditRoomReservations,
} from "@/lib/services/post-workflow.service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? new Date().toISOString().split("T")[0];
    const to = searchParams.get("to") ?? from;
    const reservations = await listEditRoomReservations(from, to);
    return NextResponse.json(reservations);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await req.json();
    const { roomId, campaignId, editorName, editorUserId, startDate, endDate, notes } = body;
    if (!roomId || !editorName || !startDate || !endDate) {
      return NextResponse.json({ error: "roomId, editorName, startDate and endDate are required" }, { status: 400 });
    }
    const records = await createEditRoomReservations({
      roomId,
      campaignId: campaignId ?? null,
      editorName,
      editorUserId: editorUserId ?? null,
      startDate,
      endDate,
      notes: notes ?? null,
      reservedBy: user.id,
    });
    return NextResponse.json(records, { status: 201 });
  } catch (err: any) {
    // Unique constraint violation = conflict
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "One or more of those days is already booked for this room." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
