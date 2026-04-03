import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  getPaymentBatch,
  updatePaymentBatchStatus,
  generateBatchCSV,
} from "@/lib/services/payment-batches.service";

// GET /api/payment-batches/[id] — batch detail with items
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin"]);
    const { id } = await params;
    const batch = await getPaymentBatch(id);
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(batch);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/payment-batches/[id]
// Actions: mark_sent, mark_confirmed, download_csv
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin"]);
    const { id } = await params;
    const body = await request.json();

    if (body.action === "mark_sent") {
      const batch = await updatePaymentBatchStatus(id, "Sent");
      return NextResponse.json(batch);
    }

    if (body.action === "mark_confirmed") {
      const batch = await updatePaymentBatchStatus(id, "Confirmed");
      return NextResponse.json(batch);
    }

    if (body.action === "download_csv") {
      const batch = await getPaymentBatch(id);
      if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const csv = generateBatchCSV(batch);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="paymaster-batch-${id.slice(0, 8)}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
