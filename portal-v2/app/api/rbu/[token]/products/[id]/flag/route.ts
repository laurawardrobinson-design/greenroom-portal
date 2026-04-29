import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProductFlag } from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";
import type { ProductFlagReason } from "@/lib/services/product-flags.service";

// POST /api/rbu/[token]/products/[id]/flag
// Token-gated. RBU raises a flag against an existing product
// belonging to their department. No edits to the product itself.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: calRow } = await db
      .from("product_request_dept_calendars")
      .select("department")
      .eq("public_token", token)
      .maybeSingle();
    if (!calRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Grant is the unified RBU reviewer — can flag products in any
    // department. The flag is recorded against the product's own dept
    // (or an explicit body.dept if provided), so the right dept team
    // sees it in their queue.
    const { data: productRow } = await db
      .from("products")
      .select("department")
      .eq("id", id)
      .maybeSingle();
    if (!productRow) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const productDept = (productRow as Record<string, unknown>)
      .department as PRDepartment;

    const body = (await request.json()) as {
      reason?: ProductFlagReason;
      comment?: string;
      dept?: PRDepartment;
    };
    const reason = body.reason;
    if (reason !== "inaccurate" && reason !== "about_to_change") {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    const flag = await createProductFlag({
      productId: id,
      flaggedByDept: body.dept ?? productDept,
      reason,
      comment: (body.comment ?? "").trim(),
    });
    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    console.error("[rbu-product-flag:POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
