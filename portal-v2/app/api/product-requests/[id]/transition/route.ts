import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { transitionPRDoc } from "@/lib/services/product-requests.service";
import type { PRDocStatus } from "@/types/domain";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    const body = (await request.json()) as { to?: PRDocStatus; comment?: string };
    if (!body.to) return NextResponse.json({ error: "to (target status) required" }, { status: 400 });
    const updated = await transitionPRDoc(id, body.to, user.id, body.comment);
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
