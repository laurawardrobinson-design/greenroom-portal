import { NextResponse } from "next/server";
import { resolveByAckToken } from "@/lib/services/call-sheet.service";

/**
 * Auth-free signed-link resolver. A call sheet distribution row's
 * ack_token serves as a shareable bearer key — a food stylist on her
 * phone at 6am can open her link without logging into the portal.
 *
 * The service strips crew phones/emails to "reach out to the Producer"
 * when tier='redacted' so freelance vendors and client never see
 * production crew numbers.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const resolved = await resolveByAckToken(token);
    if (!resolved) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    return NextResponse.json(resolved);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
