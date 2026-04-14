import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createCampaign } from "@/lib/services/campaigns.service";
import { parseCSV } from "@/lib/utils/csv-parser";

// POST /api/campaigns/import — bulk import from CSV
export async function POST(request: Request) {
  try {
    const user = await requireRole(["Admin", "Producer", "Post Producer"]);
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "CSV file required" }, { status: 400 });
    }

    const text = await file.text();
    const { rows, totalErrors } = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    // Only import rows without errors
    const validRows = rows.filter((r) => r.errors.length === 0);
    const results: { wfNumber: string; name: string; id: string }[] = [];
    const errors: { row: number; wfNumber: string; error: string }[] = [];

    for (const row of validRows) {
      try {
        const campaign = await createCampaign(
          {
            wfNumber: row.wfNumber,
            name: row.name,
            status: "Planning",
            productionBudget: row.budget,
            budgetPoolId: null,
            assetsDeliveryDate: null,
            notes: "",
          },
          user.id
        );
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

    // Include validation errors from CSV parsing
    for (const row of rows.filter((r) => r.errors.length > 0)) {
      errors.push({
        row: row.rowNumber,
        wfNumber: row.wfNumber || `Row ${row.rowNumber}`,
        error: row.errors.join(", "),
      });
    }

    return NextResponse.json({
      imported: results.length,
      failed: errors.length,
      total: validRows.length + rows.filter((r) => r.errors.length > 0).length,
      results,
      errorDetails: errors,
      failedRows: rows
        .filter((r) => r.errors.length > 0)
        .map((r) => ({
          rowNumber: r.rowNumber,
          wfNumber: r.wfNumber,
          name: r.name,
          budget: r.budget,
          shootDates: r.shootDates,
          errors: r.errors,
        })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
