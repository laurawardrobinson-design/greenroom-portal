import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse, AuthError } from "@/lib/auth/guards";
import {
  createProductFlag,
  PROPOSABLE_FIELDS,
} from "@/lib/services/product-flags.service";
import type {
  ProductFlagReason,
  ProductFlagKind,
  ProposedChanges,
  ProposableField,
} from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";

// POST /api/product-flags/internal
// Internal Producer / Admin / Post Producer can raise a flag targeted at
// a specific RBU dept + BMM for review. BMM can also raise flags.
//
// Body shapes:
//   { productId, dept, reason, comment }                             — comment flag
//   { productId, dept, reason?, comment?, kind: 'edit',
//     proposedChanges: { [field]: { from, to } } }                   — edit proposal
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
      kind?: ProductFlagKind;
      proposedChanges?: ProposedChanges;
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

    const kind: ProductFlagKind = body.kind === "edit" ? "edit" : "comment";
    let proposed: ProposedChanges | null = null;
    if (kind === "edit") {
      const validation = validateProposal(body.proposedChanges);
      if ("error" in validation) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      proposed = validation.proposedChanges;
    }

    const reason: ProductFlagReason =
      body.reason === "inaccurate" || body.reason === "about_to_change"
        ? body.reason
        : "inaccurate";

    const flag = await createProductFlag({
      productId: body.productId,
      flaggedByDept: body.dept,
      reason,
      comment: (body.comment ?? "").trim(),
      source: "producer",
      raisedByUserId: user.id,
      kind,
      proposedChanges: proposed,
    });
    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
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
