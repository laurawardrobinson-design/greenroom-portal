import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { getPRDoc, formatPREmailBody } from "@/lib/services/product-requests.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const doc = await getPRDoc(id);
    const body = formatPREmailBody(doc);
    return NextResponse.json({ body });
  } catch (error) {
    return authErrorResponse(error);
  }
}
