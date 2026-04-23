import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listProductFlags } from "@/lib/services/product-flags.service";
import type { ProductFlagStatus } from "@/lib/services/product-flags.service";

// GET /api/product-flags?status=open
// BMM / Producer / Admin / Post Producer can review all flags.
export async function GET(request: Request) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Brand Marketing Manager",
      "Studio",
    ]);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const flags = await listProductFlags(
      status ? { status: status as ProductFlagStatus } : undefined
    );
    return NextResponse.json(flags);
  } catch (error) {
    return authErrorResponse(error);
  }
}
