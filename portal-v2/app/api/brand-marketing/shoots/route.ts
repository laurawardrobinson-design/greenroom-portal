import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getBmmShoots } from "@/lib/services/brand-marketing.service";

// GET /api/brand-marketing/shoots
//
// Returns every upcoming shoot date across the BMM's portfolio, enriched
// with PR state and the departments each shoot touches. The home page
// splits the list into horizons client-side:
//   - Next 2 weeks (0–14 days out) — imminent
//   - Future (15+ days out)        — RBU weekly-meeting agenda
export async function GET() {
  try {
    const user = await requireRole(["Admin", "Brand Marketing Manager"]);
    const data = await getBmmShoots(user.id, user.deskDepartment);
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}
