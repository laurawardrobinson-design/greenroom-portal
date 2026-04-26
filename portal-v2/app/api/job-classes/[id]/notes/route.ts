import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listJobClassNotes, addJobClassNote } from "@/lib/services/job-classes.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (user.role === "Vendor") {
      return NextResponse.json([]);
    }
    const { id } = await params;
    const notes = await listJobClassNotes(id);
    return NextResponse.json(notes);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { id } = await params;
    const body = await request.json();
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "Note text required" }, { status: 400 });
    }
    const note = await addJobClassNote({
      jobClassId: id,
      text: body.text.trim(),
      authorId: user.id,
      authorName: user.name || "",
      campaignId: body.campaignId,
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
