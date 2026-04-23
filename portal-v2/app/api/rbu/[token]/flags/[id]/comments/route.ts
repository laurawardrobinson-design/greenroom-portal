import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addProductFlagComment,
  listProductFlagComments,
} from "@/lib/services/product-flags.service";
import type { PRDepartment } from "@/types/domain";

async function deptFromToken(token: string): Promise<PRDepartment | null> {
  if (!token || token.length < 20) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  const dept = (data as Record<string, unknown> | null)?.department;
  return (dept as PRDepartment) ?? null;
}

// GET /api/rbu/[token]/flags/[id]/comments
// Token-gated. Returns comments only for flags belonging to the RBU's dept.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const dept = await deptFromToken(token);
    if (!dept) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = createAdminClient();
    const { data: flagRow } = await db
      .from("product_flags")
      .select("flagged_by_dept")
      .eq("id", id)
      .maybeSingle();
    if (
      !flagRow ||
      (flagRow as Record<string, unknown>).flagged_by_dept !== dept
    ) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const comments = await listProductFlagComments(id);
    return NextResponse.json(comments);
  } catch (error) {
    console.error("[rbu-flag-comments:GET]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/rbu/[token]/flags/[id]/comments  body: { body: string }
// Token-gated comment from the RBU dept side.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const dept = await deptFromToken(token);
    if (!dept) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = createAdminClient();
    const { data: flagRow } = await db
      .from("product_flags")
      .select("flagged_by_dept")
      .eq("id", id)
      .maybeSingle();
    if (
      !flagRow ||
      (flagRow as Record<string, unknown>).flagged_by_dept !== dept
    ) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const body = (await request.json()) as { body?: string };
    const text = (body.body ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Comment cannot be empty" },
        { status: 400 }
      );
    }

    const comment = await addProductFlagComment({
      flagId: id,
      body: text,
      authorDept: dept,
      authorLabel: `${dept} team`,
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("[rbu-flag-comments:POST]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
