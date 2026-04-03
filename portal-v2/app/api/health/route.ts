import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/health — uptime monitoring endpoint (no auth required)
export async function GET() {
  const start = Date.now();

  try {
    const db = createAdminClient();
    const { error } = await db.from("users").select("id").limit(1);

    const dbOk = !error;
    const latencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: dbOk ? "healthy" : "degraded",
        database: dbOk ? "connected" : "unreachable",
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: dbOk ? 200 : 503 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "unreachable",
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
