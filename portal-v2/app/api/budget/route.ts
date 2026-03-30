import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetPools, createBudgetPool, getCategorySpending } from "@/lib/services/budget.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { searchParams } = new URL(request.url);

    if (searchParams.get("type") === "spending") {
      const spending = await getCategorySpending();
      return NextResponse.json(spending);
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
