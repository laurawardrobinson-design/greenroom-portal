import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import { createProductFlag } from "@/lib/services/product-flags.service";
import type { ProductFlagReason } from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";

// POST /api/product-flags/internal
// Internal Producer / Admin / Post Producer can raise a flag targeted at
// a specific RBU dept + BMM for review. BMM can also raise flags.
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (
      user.role !== "Producer" &&
      user.role !== "Post Producer" &&
      user.role !== "Admin" &&
      user.role !== "Brand Marketing Manager"
    ) {
      throw new AuthError("Not allowed to raise flags", 403);
    }

    const body = (await request.json()) as {
      productId?: string;
      dept?: PRDepartment;
      reason?: ProductFlagReason;
      comment?: string;
    };

    if (!body.productId) {
      return NextResponse.json(
        { error: "productId required" },
        { status: 400 }
      );
    }
    if (
      body.dept !== "Bakery" &&
      body.dept !== "Produce" &&
      body.dept !== "Deli" &&
      body.dept !== "Meat-Seafood" &&
      body.dept !== "Grocery"
    ) {
      return NextResponse.json({ error: "Invalid dept" }, { status: 400 });
    }
    if (
      body.reason !== "inaccurate" &&
      body.reason !== "about_to_change"
    ) {
      return NextResponse.json(
        { error: "Invalid reason" },
        { status: 400 }
      );
    }

    const flag = await createProductFlag({
      productId: body.productId,
      flaggedByDept: body.dept,
      reason: body.reason,
      comment: (body.comment ?? "").trim(),
      source: "producer",
      raisedByUserId: user.id,
    });
    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
