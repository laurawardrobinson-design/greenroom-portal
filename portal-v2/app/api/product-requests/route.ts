import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { listPRDocs, createPRDoc } from "@/lib/services/product-requests.service";
import type { PRDocStatus } from "@/types/domain";

const VALID_STATUSES: PRDocStatus[] = ["draft", "submitted", "forwarded", "fulfilled", "cancelled"];

// GET /api/product-requests?campaignId=...&status=draft,submitted
export async function GET(request: Request) {
  try {
    await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId") || undefined;
    const statusParam = searchParams.get("status");

    let status: PRDocStatus | PRDocStatus[] | undefined;
    if (statusParam) {
      const parts = statusParam.split(",").map((s) => s.trim()) as PRDocStatus[];
      const valid = parts.filter((p) => VALID_STATUSES.includes(p));
      if (valid.length === 1) status = valid[0];
      else if (valid.length > 1) status = valid;
    }

    const docs = await listPRDocs({ campaignId, status });
    return NextResponse.json(docs);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/product-requests — create a new PR document
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const body = (await request.json()) as { campaignId?: string; shootDate?: string; notes?: string };
    if (!body.campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    if (!body.shootDate) return NextResponse.json({ error: "shootDate required" }, { status: 400 });

    const doc = await createPRDoc({
      campaignId: body.campaignId,
      shootDate: body.shootDate,
      submittedBy: user.id,
      notes: body.notes,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
