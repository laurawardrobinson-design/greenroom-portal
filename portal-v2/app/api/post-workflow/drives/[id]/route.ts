import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getMediaDrive, updateMediaDrive } from "@/lib/services/post-workflow.service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    const drive = await getMediaDrive(id);
    if (!drive) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(drive);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    const body = await req.json();
    const drive = await updateMediaDrive(id, body);
    return NextResponse.json(drive);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
