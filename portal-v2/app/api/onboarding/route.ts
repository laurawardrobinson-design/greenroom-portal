import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listVendorOnboardingOverview } from "@/lib/services/onboarding.service";

// GET /api/onboarding — portal-wide onboarding overview (Admin only)
export async function GET() {
  try {
    await requireRole(["Admin"]);
    const overview = await listVendorOnboardingOverview();
    return NextResponse.json(overview);
  } catch (error) {
    return authErrorResponse(error);
  }
}
