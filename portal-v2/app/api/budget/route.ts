import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetPools, createBudgetPool, getCategorySpending, updateBudgetPool, getPoolTransactions } from "@/lib/services/budget.service";
import { listAllCrewBookings } from "@/lib/services/crew-bookings.service";
import { createBudgetPoolSchema, updateBudgetPoolSchema } from "@/lib/validation/budget.schema";
import { ZodError } from "zod";

function zodErrorResponse(error: ZodError) {
  const fieldErrors = error.issues.reduce((acc: Record<string, string>, err) => {
    const path = err.path.join(".") || "unknown";
    acc[path] = err.message;
    return acc;
  }, {});
  return NextResponse.json(
    { error: "Validation failed", fieldErrors },
    { status: 400 }
  );
}

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer"]);
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
    const parsed = createBudgetPoolSchema.parse(body);
    const pool = await createBudgetPool(parsed);
    return NextResponse.json(pool, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireRole(["Admin"]);
    const body = await request.json();
    const { id, ...rest } = updateBudgetPoolSchema.parse(body);
    await updateBudgetPool(id, rest);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return authErrorResponse(error);
  }
}
