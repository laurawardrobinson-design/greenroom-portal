import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { linkProductToCampaign, listCampaignProducts } from "@/lib/services/products.service";
import { createProduct } from "@/lib/services/products.service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { id: campaignId } = await params;
    const products = await listCampaignProducts(campaignId);
    return NextResponse.json(products);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST: link an existing product OR create an ad-hoc product and link it
// Body: { productId: string } — link existing product
// Body: { name: string }     — create ad-hoc product (no item code) and link
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer", "Art Director", "Studio"]);
    const { id: campaignId } = await params;
    const body = await request.json();

    let productId: string;

    if (body.productId) {
      // Link existing inventory product
      productId = body.productId;
    } else if (body.name && typeof body.name === "string") {
      // Create an ad-hoc product (no item code) then link it
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }

      // Check if a product with this exact name (and no item code) already exists
      const db = createAdminClient();
      const { data: existing } = await db
        .from("products")
        .select("id")
        .ilike("name", trimmed)
        .is("item_code", null)
        .maybeSingle();

      if (existing) {
        productId = existing.id as string;
      } else {
        const created = await createProduct(
          {
            name: trimmed,
            department: "Other",
            itemCode: null,
            description: "",
            shootingNotes: "",
            restrictions: "",
            pcomLink: null,
            rpGuideUrl: null,
            imageUrl: null,
            lifecyclePhase: "live",
          },
          user.id
        );
        productId = created.id;
      }
    } else {
      return NextResponse.json(
        { error: "productId or name is required" },
        { status: 400 }
      );
    }

    // Link (idempotent — returns existing if already linked)
    const db2 = createAdminClient();
    const { data: cpRows } = await db2
      .from("campaign_products")
      .select("*, products(*)")
      .eq("campaign_id", campaignId)
      .order("sort_order", { ascending: true });

    const sortOrder = (cpRows?.length ?? 0);
    const campaignProduct = await linkProductToCampaign(campaignId, productId, "", sortOrder);
    return NextResponse.json(campaignProduct, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
