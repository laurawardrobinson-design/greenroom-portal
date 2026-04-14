import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { listEditRooms } from "@/lib/services/post-workflow.service";

export async function GET() {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const rooms = await listEditRooms();
    return NextResponse.json(rooms);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
