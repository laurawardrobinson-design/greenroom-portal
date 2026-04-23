import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getMasterCalendar } from "@/lib/services/product-requests.service";

// GET /api/product-requests/calendar/master
// BMM / Admin only. Returns all departments' entries on one view,
// plus the share-tokens so BMM can copy per-department links.
export async function GET() {
  try {
    await requireRole(["Admin", "Brand Marketing Manager"]);
    const data = await getMasterCalendar();
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}
