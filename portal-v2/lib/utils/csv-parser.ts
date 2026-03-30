/**
 * Parse CSV text into campaign import rows.
 * Expected columns: WF#, Name, Brand, Budget, Shoot Dates (comma-separated within quotes)
 */

export interface CsvCampaignRow {
  rowNumber: number;
  wfNumber: string;
  name: string;
  budget: number;
  shootDates: string[];
  errors: string[];
}

export interface CsvParseResult {
  rows: CsvCampaignRow[];
  headers: string[];
  totalErrors: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const COLUMN_MAP: Record<string, string> = {
  "wf#": "wfNumber",
  "wf number": "wfNumber",
  wfnumber: "wfNumber",
  wf: "wfNumber",
  name: "name",
  "campaign name": "name",
  campaign: "name",
  budget: "budget",
  "production budget": "budget",
  "shoot dates": "shootDates",
  "shoot date": "shootDates",
  dates: "shootDates",
};

export function parseCSV(text: string): CsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { rows: [], headers: [], totalErrors: 1 };
  }

  const headerCells = parseCSVLine(lines[0]);
  const headers = headerCells.map((h) => h.toLowerCase().trim());

  // Map headers to known fields
  const columnIndexes: Record<string, number> = {};
  headers.forEach((h, i) => {
    const mapped = COLUMN_MAP[h];
    if (mapped) columnIndexes[mapped] = i;
  });

  const rows: CsvCampaignRow[] = [];
  let totalErrors = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const errors: string[] = [];

    const wfRaw = cells[columnIndexes.wfNumber]?.trim() || "";
    const wfNumber = wfRaw.replace(/^WF[-\s]?(\d+)$/i, (_, n) => `WF${n}`) || wfRaw;
    const name = cells[columnIndexes.name]?.trim() || "";
    const budgetStr = cells[columnIndexes.budget]?.trim() || "0";
    const datesStr = cells[columnIndexes.shootDates]?.trim() || "";

    if (!wfNumber) errors.push("Missing WF#");
    if (!name) errors.push("Missing name");

    const budget = Number(budgetStr.replace(/[$,]/g, ""));
    if (isNaN(budget)) errors.push("Invalid budget");

    // Parse shoot dates (comma-separated within the field, or semicolon)
    const shootDates = datesStr
      ? datesStr
          .split(/[;,]/)
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => {
            // Try to parse various date formats
            let parsed: Date | null = null;

            // Try ISO format first (YYYY-MM-DD)
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
              parsed = new Date(d + "T00:00:00Z");
            }
            // Try MM/DD/YYYY
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) {
              const [m, day, y] = d.split("/");
              parsed = new Date(`${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00Z`);
            }
            // Try DD/MM/YYYY (less common but possible)
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) {
              // Assume MM/DD/YYYY for US users
              const [m, day, y] = d.split("/");
              parsed = new Date(`${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00Z`);
            }
            // Try generic date parse as fallback
            else {
              parsed = new Date(d);
            }

            if (!parsed || isNaN(parsed.getTime())) {
              errors.push(`Invalid date format: ${d} (use YYYY-MM-DD, MM/DD/YYYY, or similar)`);
              return "";
            }

            // Check if date is in the past
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (parsed < today) {
              errors.push(`Shoot date cannot be in the past: ${d}`);
              return "";
            }

            // Check if date is more than 2 years in future (sanity check)
            const twoYearsFromNow = new Date();
            twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
            if (parsed > twoYearsFromNow) {
              errors.push(`Shoot date is too far in the future (max 2 years): ${d}`);
              return "";
            }

            return parsed.toISOString().split("T")[0];
          })
          .filter(Boolean)
      : [];

    totalErrors += errors.length;
    rows.push({
      rowNumber: i + 1,
      wfNumber,
      name,
      budget: isNaN(budget) ? 0 : budget,
      shootDates,
      errors,
    });
  }

  return { rows, headers: headerCells, totalErrors };
}
