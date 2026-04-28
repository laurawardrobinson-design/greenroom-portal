import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getBmmShoots } from "@/lib/services/brand-marketing.service";

// GET /api/brand-marketing/shoots
// GET /api/brand-marketing/shoots?month=YYYY-MM
// GET /api/brand-marketing/shoots?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Default: every upcoming shoot date across the BMM's portfolio (used by
// the horizon rails). When `month` or `from`/`to` is supplied, returns
// shoots inside that window — past dates included — for the calendar
// dashboard.
export async function GET(request: Request) {
  try {
    const user = await requireRole(["Admin", "Brand Marketing Manager"]);
    const { searchParams } = new URL(request.url);

    const month = searchParams.get("month");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    let range: { from: string; to?: string } | undefined;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split("-").map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      range = {
        from: `${month}-01`,
        to: `${month}-${String(lastDay).padStart(2, "0")}`,
      };
    } else if (fromParam) {
      range = { from: fromParam, to: toParam ?? undefined };
    }

    const data = await getBmmShoots(user.id, user.deskDepartment, range);
    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}
