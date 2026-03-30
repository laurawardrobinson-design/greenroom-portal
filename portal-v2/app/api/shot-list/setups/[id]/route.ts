import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { updateSetup, deleteSetup } from "@/lib/services/shot-list.service";
import { updateSetupSchema } from "@/lib/validation/shot-list.schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSetupSchema.parse(body);
    const setup = await updateSetup(id, parsed);
    return NextResponse.json(setup);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const { id } = await params;
    await deleteSetup(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
