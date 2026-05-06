import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createProductFlag,
  PROPOSABLE_FIELDS,
} from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";
import type {
  ProductFlagReason,
  ProductFlagKind,
  ProposedChanges,
  ProposableField,
} from "@/lib/services/product-flags.service";

// POST /api/rbu/[token]/products/[id]/flag
// Token-gated. RBU raises a flag against an existing product
// belonging to their department. No edits to the product itself —
// edit-kind flags carry a structured proposal that producers can
// accept or decline from the flag review modal.
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
      kind?: ProductFlagKind;
      proposedChanges?: ProposedChanges;
    };

    const kind: ProductFlagKind = body.kind === "edit" ? "edit" : "comment";
    let proposed: ProposedChanges | null = null;
    if (kind === "edit") {
      const validation = validateProposal(body.proposedChanges);
      if ("error" in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      proposed = validation.proposedChanges;
    } else if (
      body.reason !== "inaccurate" &&
      body.reason !== "about_to_change"
    ) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    const reason: ProductFlagReason =
      body.reason === "inaccurate" || body.reason === "about_to_change"
        ? body.reason
        : "inaccurate";

    const flag = await createProductFlag({
      productId: id,
      flaggedByDept: body.dept ?? productDept,
      reason,
      comment: (body.comment ?? "").trim(),
      kind,
      proposedChanges: proposed,
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

function validateProposal(
  raw: ProposedChanges | undefined
): { proposedChanges: ProposedChanges } | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "proposedChanges required for edit kind" };
  }
  const out: ProposedChanges = {};
  for (const key of Object.keys(raw) as ProposableField[]) {
    if (!PROPOSABLE_FIELDS.includes(key)) {
      return { error: `Field "${key}" is not editable` };
    }
    const change = raw[key];
    if (!change || typeof change !== "object" || !("to" in change)) {
      return { error: `Field "${key}" must include {from, to}` };
    }
    out[key] = { from: change.from ?? null, to: change.to ?? null };
  }
  if (Object.keys(out).length === 0) {
    return { error: "proposedChanges must include at least one field" };
  }
  return { proposedChanges: out };
}
