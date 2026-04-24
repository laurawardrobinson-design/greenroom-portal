import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  approveShot,
  unapproveShot,
  updateShotApprovalNotes,
} from "@/lib/services/shot-list.service";

// POST  = CD signs off (stamps approved_by, approved_at, snapshot, optional notes)
// PATCH = CD edits notes without re-signing
// DELETE = CD revokes sign-off (clears notes as well)
//
// Sign-off is advisory — it never blocks the shoot — so only the Creative
// Director (plus Admin as superuser fallback) can act on it. Producer /
// Art Director see the state but cannot change it from the UI; the guard
// below is the authoritative check.

const CD_ROLES = ["Admin", "Creative Director"] as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole([...CD_ROLES]);
    const { id } = await params;
    let notes: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.notes === "string") notes = body.notes;
    } catch {
      // Empty body is fine — sign off with no notes
    }
    const shot = await approveShot(id, user.id, notes);
    return NextResponse.json(shot);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([...CD_ROLES]);
    const { id } = await params;
    const body = await request.json();
    if (typeof body?.notes !== "string") {
      return NextResponse.json({ error: "notes is required" }, { status: 400 });
    }
    const shot = await updateShotApprovalNotes(id, body.notes);
    return NextResponse.json(shot);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([...CD_ROLES]);
    const { id } = await params;
    const shot = await unapproveShot(id);
    return NextResponse.json(shot);
  } catch (error) {
    return authErrorResponse(error);
  }
}
