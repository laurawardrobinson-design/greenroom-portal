import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getActiveWardrobeCheckouts } from "@/lib/services/wardrobe.service";

export async function GET() {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const checkouts = await getActiveWardrobeCheckouts();
    return NextResponse.json(checkouts);
  } catch (error) {
    return authErrorResponse(error);
  }
}
