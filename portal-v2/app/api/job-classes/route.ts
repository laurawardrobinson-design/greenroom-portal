import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listJobClasses, createJobClass } from "@/lib/services/job-classes.service";

export async function GET() {
  try {
    await getAuthUser();
    const classes = await listJobClasses();
    return NextResponse.json(classes);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const body = await request.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const jc = await createJobClass(
      { name: body.name.trim(), description: body.description, standards: body.standards },
      user.id
    );
    return NextResponse.json(jc, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
