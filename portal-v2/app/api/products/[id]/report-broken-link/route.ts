import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { markPcomLinkBroken } from "@/lib/services/products.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
      "Studio",
      "Brand Marketing Manager",
    ]);
    const { id } = await params;
    const product = await markPcomLinkBroken(id);
    return NextResponse.json(product);
  } catch (error) {
    return authErrorResponse(error);
  }
}
