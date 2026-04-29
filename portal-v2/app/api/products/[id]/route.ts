import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getProduct, updateProduct, deleteProduct, getProductCampaignHistory, getProductShootSchedule, getProductLastApproval } from "@/lib/services/products.service";
import { updateProductSchema } from "@/lib/validation/products.schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio", "Vendor", "Brand Marketing Manager"]);
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("history") === "true";

    const product = await getProduct(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (includeHistory) {
      const [history, schedule, lastApproval] = await Promise.all([
        getProductCampaignHistory(id),
        getProductShootSchedule(id),
        getProductLastApproval(id),
      ]);
      return NextResponse.json({ product, campaigns: history, upcoming: schedule.upcoming, planning: schedule.planning, lastApproval });
    }

    return NextResponse.json(product);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio", "Brand Marketing Manager"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.parse(body);
    const product = await updateProduct(id, parsed);
    return NextResponse.json(product);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
    const { id } = await params;
    await deleteProduct(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
