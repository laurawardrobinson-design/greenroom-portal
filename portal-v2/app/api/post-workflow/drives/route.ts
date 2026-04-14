import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { listMediaDrives, createMediaDrive } from "@/lib/services/post-workflow.service";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { searchParams } = new URL(req.url);
    const drives = await listMediaDrives({
      status: searchParams.get("status") ?? undefined,
      storageSize: searchParams.get("size") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });
    return NextResponse.json(drives);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await req.json();
    const drive = await createMediaDrive(body);
    return NextResponse.json(drive, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
