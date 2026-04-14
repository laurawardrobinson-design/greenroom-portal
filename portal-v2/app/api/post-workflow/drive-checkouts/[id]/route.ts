import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { processDriveReturn } from "@/lib/services/post-workflow.service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id: sessionId } = await params;
    const body = await req.json();
    const { itemId, conditionIn, actualReturnDate, dataOffloadedBackedUp, backupLocation, driveWiped, clearForReuse, notes } = body;
    if (!itemId || !conditionIn || !actualReturnDate) {
      return NextResponse.json({ error: "itemId, conditionIn and actualReturnDate are required" }, { status: 400 });
    }
    await processDriveReturn(itemId, sessionId, {
      conditionIn,
      actualReturnDate,
      dataOffloadedBackedUp,
      backupLocation,
      driveWiped,
      clearForReuse,
      notes,
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
