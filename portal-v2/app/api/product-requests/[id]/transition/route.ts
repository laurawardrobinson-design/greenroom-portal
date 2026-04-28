import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { transitionPRDoc, getPRDoc } from "@/lib/services/product-requests.service";
import type { PRDocStatus } from "@/types/domain";

const ALLOWED_TRANSITIONS: Record<PRDocStatus, PRDocStatus[]> = {
  draft:     ["submitted", "cancelled"],
  submitted: ["forwarded", "cancelled"],
  forwarded: ["confirmed", "cancelled"],
  confirmed: [],
  cancelled: [],
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const body = (await request.json()) as { to?: PRDocStatus; comment?: string };
    if (!body.to) return NextResponse.json({ error: "to (target status) required" }, { status: 400 });

    const current = await getPRDoc(id);
    const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(body.to)) {
      return NextResponse.json(
        { error: `Cannot transition from ${current.status} to ${body.to}` },
        { status: 422 }
      );
    }

    const updated = await transitionPRDoc(id, body.to, user.id, body.comment);
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
