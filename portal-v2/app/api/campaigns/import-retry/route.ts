import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createCampaign } from "@/lib/services/campaigns.service";
import { createCampaignSchema } from "@/lib/validation/campaigns.schema";

interface RetryRow {
  rowNumber: number;
  wfNumber: string;
  name: string;
  budget: number;
}

// POST /api/campaigns/import-retry — retry previously failed CSV rows
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer"]);
    const body = await request.json();
    const rows: RetryRow[] = body.rows || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided" },
        { status: 400 }
      );
    }

    const results: { wfNumber: string; name: string; id: string }[] = [];
    const errors: { row: number; wfNumber: string; error: string }[] = [];

    for (const row of rows) {
      try {
        // Validate the row data
        const validated = createCampaignSchema.parse({
          wfNumber: row.wfNumber,
          name: row.name,
          brand: row.brand,
          status: "Planning",
          productionBudget: row.budget,
          budgetPoolId: null,
          assetsDeliveryDate: null,
          notes: "",
        });

        const campaign = await createCampaign(validated, user.id);
        results.push({
          wfNumber: row.wfNumber,
          name: row.name,
          id: campaign.id,
        });
      } catch (err) {
        errors.push({
          row: row.rowNumber,
          wfNumber: row.wfNumber,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      imported: results.length,
      failed: errors.length,
      results,
      errorDetails: errors,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
