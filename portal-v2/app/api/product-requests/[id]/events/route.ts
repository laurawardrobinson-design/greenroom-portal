import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { getPREvents } from "@/lib/services/product-requests.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const events = await getPREvents(id);
    return NextResponse.json(events);
  } catch (error) {
    return authErrorResponse(error);
  }
}
