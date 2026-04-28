import { NextResponse } from "next/server";
import { getDeptCalendarByToken } from "@/lib/services/product-requests.service";

// GET /api/product-requests/calendar/[token]
// Public, token-gated. Returns a department's calendar view —
// all forwarded/confirmed PR sections in that department. No auth
// required; knowing the token is the capability.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const view = await getDeptCalendarByToken(token);
    if (!view) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(view);
  } catch (error) {
    console.error("[pr-dept-calendar-by-token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
