import { NextResponse } from "next/server";
import { approvePRSectionByToken } from "@/lib/services/product-requests.service";

// POST /api/product-requests/view/[token]/approve
// Public, token-gated. RBU reviewer (Grant) approves the dept PR section
// they were emailed. Stamps rbu_approved_at + rbu_approved_by_name and
// flips the parent doc to "confirmed". Idempotent — re-approving returns
// the original stamp.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    // RBU surface is unified under "Grant" (see rbu-sidebar identity).
    const result = await approvePRSectionByToken(token, "Grant");
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[pr-view-approve]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
