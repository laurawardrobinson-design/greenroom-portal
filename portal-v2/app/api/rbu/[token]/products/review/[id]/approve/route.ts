import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setCampaignProductRbuApproval } from "@/lib/services/products.service";

// POST /api/rbu/[token]/products/review/[id]/approve
// Token-gated. Grant (RBU reviewer) marks a campaign_products link as
// approved-accurate. id = campaign_products.id.
async function validateToken(token: string): Promise<boolean> {
  if (!token || token.length < 20) return false;
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  return !!data;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    if (!(await validateToken(token))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await setCampaignProductRbuApproval(id, true, null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[rbu-approve:POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    if (!(await validateToken(token))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await setCampaignProductRbuApproval(id, false, null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[rbu-approve:DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
