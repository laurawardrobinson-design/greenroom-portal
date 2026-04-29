import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listProductFlagComments,
  addProductFlagComment,
} from "@/lib/services/product-flags.service";

// Token-gated flag comments for the RBU products surface.
// Grant (RBU reviewer) can read the discussion thread on any flag and
// post comments back to BMM / dept teams.
async function validateToken(
  token: string
): Promise<{ ok: true; dept: string } | { ok: false }> {
  if (!token || token.length < 20) return { ok: false };
  const db = createAdminClient();
  const { data } = await db
    .from("product_request_dept_calendars")
    .select("department")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return { ok: false };
  return { ok: true, dept: (data as Record<string, unknown>).department as string };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const v = await validateToken(token);
    if (!v.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const comments = await listProductFlagComments(id);
    return NextResponse.json(comments);
  } catch (error) {
    console.error("[rbu-flag-comments:GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const v = await validateToken(token);
    if (!v.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      authorUserId: null,
      authorLabel: "RBU reviewer",
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("[rbu-flag-comments:POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
