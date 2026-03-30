import { NextResponse } from "next/server";
import { requireRole, getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createShot } from "@/lib/services/shot-list.service";
import { createShotSchema } from "@/lib/validation/shot-list.schema";

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director"]);
    const body = await request.json();
    const parsed = createShotSchema.parse(body);
    const shot = await createShot(parsed);
    return NextResponse.json(shot, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
