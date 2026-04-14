import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createShoot } from "@/lib/services/shoots.service";
import { createShootSchema } from "@/lib/validation/campaigns.schema";

// POST /api/shoots — create a shoot under a campaign
export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const body = await request.json();
    const parsed = createShootSchema.parse(body);
    const shoot = await createShoot(parsed);
    return NextResponse.json(shoot, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
