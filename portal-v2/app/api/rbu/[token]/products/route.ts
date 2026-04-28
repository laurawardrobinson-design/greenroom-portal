import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenFlagCounts } from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";

export interface RBUProduct {
  id: string;
  itemCode: string | null;
  name: string;
  description: string;
  restrictions: string;
  imageUrl: string | null;
  rpGuideUrl: string | null;
  pcomLink: string | null;
  pcomLinkBrokenAt: string | null;
  openFlagCount: number;
}

async function resolveDeptFromToken(
  token: string
): Promise<PRDepartment | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;
  return (data as Record<string, unknown>).department as PRDepartment;
}

// GET /api/rbu/[token]/products
// Token-gated. Returns products for the department the token
// belongs to. Explicitly omits `shooting_notes` (internal production
// notes that RBU teams should not see). Includes openFlagCount so
// the UI can mark items the RBU team has already flagged.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const department = await resolveDeptFromToken(token);
    if (!department) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("products")
      .select(
        "id, item_code, name, description, restrictions, image_url, rp_guide_url, pcom_link, pcom_link_broken_at"
      )
      .eq("department", department)
      .order("name", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    const flagCounts = await getOpenFlagCounts(
      rows.map((r) => (r as Record<string, unknown>).id as string)
    );

    const products: RBUProduct[] = rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        itemCode: (r.item_code as string) || null,
        name: r.name as string,
        description: (r.description as string) || "",
        restrictions: (r.restrictions as string) || "",
        imageUrl: (r.image_url as string) || null,
        rpGuideUrl: (r.rp_guide_url as string) || null,
        pcomLink: (r.pcom_link as string) || null,
        pcomLinkBrokenAt: (r.pcom_link_broken_at as string) || null,
        openFlagCount: flagCounts.get(r.id as string) ?? 0,
      };
    });

    return NextResponse.json({ department, products });
  } catch (error) {
    console.error("[rbu-products-by-token:GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/rbu/[token]/products
// Token-gated. Adds a new product to the catalog for this department.
// `department` is forced from the token — RBU can only add to their
// own dept. `shooting_notes` is ignored (RBU never writes it).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || token.length < 20) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const department = await resolveDeptFromToken(token);
    if (!department) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      itemCode?: string | null;
      description?: string;
      restrictions?: string;
      imageUrl?: string | null;
      rpGuideUrl?: string | null;
      pcomLink?: string | null;
    };
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("products")
      .insert({
        name,
        department,
        item_code: (body.itemCode ?? "").trim() || null,
        description: (body.description ?? "").trim(),
        restrictions: (body.restrictions ?? "").trim(),
        image_url: (body.imageUrl ?? "").trim() || null,
        rp_guide_url: (body.rpGuideUrl ?? "").trim() || null,
        pcom_link: (body.pcomLink ?? "").trim() || null,
        shooting_notes: "",
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json(
      { id: (data as { id: string }).id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[rbu-products-by-token:POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
