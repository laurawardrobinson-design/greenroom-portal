import { NextResponse } from "next/server";
import { markAckedByToken } from "@/lib/services/call-sheet.service";

/**
 * Auth-free ack endpoint. The recipient clicks "I got this call sheet"
 * on the signed-link view; this stamps acked_at so the producer sees
 * confirmation in the distribution list.
 *
 * Only the first ack counts — subsequent clicks return the same
 * already-acked row without re-stamping.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const distribution = await markAckedByToken(token);
    if (!distribution) {
      return NextResponse.json({ ok: true, alreadyAcked: true });
    }
    return NextResponse.json({ ok: true, ackedAt: distribution.ackedAt });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
