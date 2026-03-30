import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { addShootDates } from "@/lib/services/shoots.service";
import { shootDateSchema } from "@/lib/validation/campaigns.schema";
import { z } from "zod";

// POST /api/shoots/[id]/dates — add dates to a shoot
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = z.array(shootDateSchema).parse(body.dates || [body]);
    const dates = await addShootDates(id, parsed);
    return NextResponse.json(dates, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
