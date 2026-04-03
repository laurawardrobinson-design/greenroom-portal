import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import {
  listPaymentBatches,
  createPaymentBatch,
  listApprovedUnbatchedPayments,
} from "@/lib/services/payment-batches.service";

// GET /api/payment-batches — list all batches
// GET /api/payment-batches?unbatched=true — list approved unbatched payments
export async function GET(request: Request) {
  try {
    await requireRole(["Admin"]);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("unbatched") === "true") {
      const payments = await listApprovedUnbatchedPayments();
      return NextResponse.json(payments);
    }

    const batches = await listPaymentBatches();
    return NextResponse.json(batches);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/payment-batches — create batch from all approved unbatched payments
export async function POST() {
  try {
    const user = await getAuthUser();
    await requireRole(["Admin"]);
    const batch = await createPaymentBatch(user.id);
    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
