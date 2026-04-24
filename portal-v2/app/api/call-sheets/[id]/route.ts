import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getCallSheet, updateDraft } from "@/lib/services/call-sheet.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
      "Studio",
      "Creative Director",
      "Designer",
      "Brand Marketing Manager",
    ]);
    const { id } = await params;
    const sheet = await getCallSheet(id);
    if (!sheet) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(sheet);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const { id } = await params;
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const sheet = await updateDraft(id, body);
    return NextResponse.json(sheet);
  } catch (error) {
    return authErrorResponse(error);
  }
}
