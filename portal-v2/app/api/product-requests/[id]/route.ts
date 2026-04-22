import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { getPRDoc, updatePRDoc } from "@/lib/services/product-requests.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const doc = await getPRDoc(id);
    return NextResponse.json(doc);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const body = (await request.json()) as { notes?: string; shootDate?: string };
    const updated = await updatePRDoc(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return authErrorResponse(error);
  }
}
