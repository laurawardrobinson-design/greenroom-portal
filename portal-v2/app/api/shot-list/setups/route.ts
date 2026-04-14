import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listSetups, createSetup } from "@/lib/services/shot-list.service";
import { createSetupSchema } from "@/lib/validation/shot-list.schema";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio", "Vendor"]);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }
    const setups = await listSetups(campaignId);
    return NextResponse.json(setups);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director"]);
    const body = await request.json();
    const parsed = createSetupSchema.parse(body);
    const setup = await createSetup(parsed);
    return NextResponse.json(setup, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
