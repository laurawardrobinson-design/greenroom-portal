import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getJobClass, updateJobClass, deleteJobClass } from "@/lib/services/job-classes.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const jc = await getJobClass(id);
    if (!jc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(jc);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const { id } = await params;
    const body = await request.json();
    const jc = await updateJobClass(id, {
      name: body.name,
      department: body.department,
      standards: body.standards,
      restrictions: body.restrictions,
      referenceUrl: body.referenceUrl,
    });
    return NextResponse.json(jc);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { id } = await params;
    await deleteJobClass(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
