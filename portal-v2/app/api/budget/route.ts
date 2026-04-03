import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetPools, createBudgetPool, getCategorySpending, updateBudgetPool, getPoolTransactions } from "@/lib/services/budget.service";
import { listAllCrewBookings } from "@/lib/services/crew-bookings.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("type") === "spending") {
      const spending = await getCategorySpending();
      return NextResponse.json(spending);
    }

    if (searchParams.get("type") === "crew") {
      const bookings = await listAllCrewBookings();
      return NextResponse.json(bookings);
    }

    // Pool transaction history
    const poolId = searchParams.get("poolId");
    if (poolId && searchParams.get("type") === "transactions") {
      const transactions = await getPoolTransactions(poolId);
      return NextResponse.json(transactions);
    }

    const pools = await listBudgetPools();
    return NextResponse.json(pools);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["Admin"]);
    const body = await request.json();
    const pool = await createBudgetPool(body);
    return NextResponse.json(pool, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin"]);
    const body = await request.json();
    await updateBudgetPool(body.id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
