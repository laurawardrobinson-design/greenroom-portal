import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenFlagCounts } from "@/lib/services/product-flags.service";
import type {
  PRDepartment,
  Product,
  ProductDepartment,
  ProductLifecyclePhase,
} from "@/types/domain";

// RBU-facing list extends the full Product shape so the same client-side
// directory view used by BMM can render these rows directly. We keep
// `openFlagCount` as an extra field for the flag badge.
export interface RBUProduct extends Product {
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

    // RBU users get the same full-catalog view BMM does (matching the
    // /api/products endpoint), not a department-scoped slice. The token
    // proves the user is an RBU rep — it doesn't restrict what they see.
    const db = createAdminClient();
    const { data, error } = await db
      .from("products")
      .select("*")
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
        name: r.name as string,
        department: r.department as ProductDepartment,
        itemCode: (r.item_code as string) || null,
        description: (r.description as string) || "",
        // shooting_notes is intentionally omitted from RBU view — it's
        // internal production direction RBU shouldn't see. The BMM view
        // hides it via hideTeamNotes when rendered for RBU.
        shootingNotes: "",
        restrictions: (r.restrictions as string) || "",
        pcomLink: (r.pcom_link as string) || null,
        pcomLinkBrokenAt: (r.pcom_link_broken_at as string) || null,
        rpGuideUrl: (r.rp_guide_url as string) || null,
        imageUrl: (r.image_url as string) || null,
        lifecyclePhase:
          ((r.lifecycle_phase as ProductLifecyclePhase) ?? "live") as ProductLifecyclePhase,
        createdBy: (r.created_by as string) || null,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
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
