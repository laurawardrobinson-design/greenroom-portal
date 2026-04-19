import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";

// ─── Shape ───────────────────────────────────────────────────────────────────

/**
 * One parsed row. `matchedVia` tells the UI how the product resolved so we can
 * show "matched by SKU 001234" vs "matched by name 'Berry Chantilly Cake'".
 * Unmatched rows carry `null` for campaignProductId + productName.
 */
export interface ParsedRunCsvRow {
  rowIndex: number; // 1-based, excluding header
  rawKey: string;
  matchedVia: "uuid" | "item_code" | "name" | null;
  campaignProductId: string | null;
  productName: string | null;
  copy: Record<string, string>;
}

export interface ParsedRunCsv {
  headers: string[]; // as typed, in file order
  productKeyHeader: string; // first column — the key used to match each row
  bindingHeaders: string[]; // remaining columns = dynamic binding paths
  ignoredHeaders: string[]; // bindings not in the template's dynamic bindings
  matched: ParsedRunCsvRow[];
  unmatched: ParsedRunCsvRow[];
  warnings: string[];
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Parse a CSV against a campaign + template. Header row is REQUIRED. First
 * column is treated as the product key (SKU / item_code / product.name / UUID
 * — same matching order as the paste-list mode). Remaining columns map to
 * dynamic binding paths.
 *
 * We validate bindings against `allowedBindings` so a user who pastes a stale
 * CSV doesn't silently drop cells into a binding the template no longer has.
 */
export async function parseRunCsv(params: {
  csvText: string;
  campaignId: string;
  allowedBindings: string[];
}): Promise<ParsedRunCsv> {
  const { csvText, campaignId, allowedBindings } = params;

  // Strip BOM + normalize line endings so Excel exports don't mis-split.
  const normalized = csvText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  const parseResult = Papa.parse<string[]>(normalized.trim(), {
    skipEmptyLines: true,
    // Header handling is done manually so we can validate first-column vs
    // binding columns independently.
    header: false,
  });

  if (parseResult.errors.length > 0) {
    // Papa errors include row indices — surface the first one.
    throw new Error(
      `CSV parse error at row ${parseResult.errors[0].row ?? "?"}: ${parseResult.errors[0].message}`
    );
  }

  const rows = parseResult.data.filter((r) => r.length > 0 && r.some((c) => c?.trim() !== ""));
  if (rows.length < 2) {
    throw new Error("CSV needs a header row plus at least one data row.");
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => (h ?? "").trim());
  const [productKeyHeader, ...bindingHeadersRaw] = headers;

  if (!productKeyHeader) {
    throw new Error("First column must be a header (e.g. 'sku', 'product', 'name').");
  }

  const allowedSet = new Set(allowedBindings);
  const bindingHeaders: string[] = [];
  const ignoredHeaders: string[] = [];
  for (const h of bindingHeadersRaw) {
    if (h && allowedSet.has(h)) bindingHeaders.push(h);
    else if (h) ignoredHeaders.push(h);
  }

  const warnings: string[] = [];
  if (ignoredHeaders.length > 0) {
    warnings.push(
      `${ignoredHeaders.length} unknown header${ignoredHeaders.length === 1 ? "" : "s"}: ${ignoredHeaders
        .slice(0, 5)
        .join(", ")}${ignoredHeaders.length > 5 ? ", …" : ""}. Known bindings: ${allowedBindings.join(
        ", "
      ) || "(none)"}`
    );
  }

  // Pull the campaign's products once — we need to resolve every row against
  // this scope. Uses the caller's supabase client so RLS is honored.
  const supabase = await createClient();
  const { data: cps, error } = await supabase
    .from("campaign_products")
    .select("id, product_id, products(id, name, item_code)")
    .eq("campaign_id", campaignId);
  if (error) throw error;

  type CpRow = {
    id: string;
    product_id: string;
    products: { id: string; name: string; item_code: string | null } | null;
  };
  const cpList = (cps ?? []) as unknown as CpRow[];

  const matched: ParsedRunCsvRow[] = [];
  const unmatched: ParsedRunCsvRow[] = [];

  dataRows.forEach((row, i) => {
    const rowIndex = i + 1;
    const rawKey = (row[0] ?? "").trim();
    if (!rawKey) {
      warnings.push(`Row ${rowIndex} has an empty key — skipped.`);
      return;
    }
    const lcKey = rawKey.toLowerCase();

    // Build the copy dict from the binding columns. Map by the ORIGINAL header
    // index in the CSV so a reordered file still lines up.
    const copy: Record<string, string> = {};
    for (let colIdx = 0; colIdx < bindingHeadersRaw.length; colIdx++) {
      const header = bindingHeadersRaw[colIdx]?.trim();
      if (!header || !allowedSet.has(header)) continue;
      const cell = (row[colIdx + 1] ?? "").trim();
      if (cell !== "") copy[header] = cell;
    }

    // Try UUID first (exact CP id), then item_code, then product name.
    let matchedVia: ParsedRunCsvRow["matchedVia"] = null;
    let hit: CpRow | undefined;
    hit = cpList.find(
      (cp) =>
        cp.id === rawKey ||
        cp.product_id === rawKey ||
        cp.products?.id === rawKey
    );
    if (hit) matchedVia = "uuid";
    if (!hit) {
      hit = cpList.find((cp) => (cp.products?.item_code ?? "").toLowerCase() === lcKey);
      if (hit) matchedVia = "item_code";
    }
    if (!hit) {
      hit = cpList.find((cp) => (cp.products?.name ?? "").toLowerCase() === lcKey);
      if (hit) matchedVia = "name";
    }

    const parsed: ParsedRunCsvRow = {
      rowIndex,
      rawKey,
      matchedVia,
      campaignProductId: hit?.id ?? null,
      productName: hit?.products?.name ?? null,
      copy,
    };
    if (hit) matched.push(parsed);
    else unmatched.push(parsed);
  });

  return {
    headers,
    productKeyHeader,
    bindingHeaders,
    ignoredHeaders,
    matched,
    unmatched,
    warnings,
  };
}
