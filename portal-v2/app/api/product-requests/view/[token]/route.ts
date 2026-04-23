import { NextResponse } from "next/server";
import { getPRSectionByToken } from "@/lib/services/product-requests.service";

// GET /api/product-requests/view/[token]
// Public, token-gated read. Returns one department section's data
// (doc header, shoot info, pickup, items) for the vendor-facing
// view at /pr/view/[token]. No auth required — knowing the token
// is the capability.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const view = await getPRSectionByToken(token);
    if (!view) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Only expose the section once the producer has submitted the PR.
    // Drafts are not shareable.
    if (view.status === "draft" || view.status === "cancelled") {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    return NextResponse.json(view);
  } catch (error) {
    console.error("[pr-view-by-token]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
