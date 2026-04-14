import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import {
  cancelEditRoomReservationGroup,
  updateEditRoomReservationGroup,
} from "@/lib/services/post-workflow.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { groupId } = await params;
    const body = await req.json();
    await updateEditRoomReservationGroup(groupId, {
      editorName: body.editorName,
      campaignId: body.campaignId,
      notes: body.notes,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { groupId } = await params;
    await cancelEditRoomReservationGroup(groupId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
