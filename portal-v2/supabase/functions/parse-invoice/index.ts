// Supabase Edge Function: parse-invoice
// Downloads invoice from private storage, attempts pattern-based parsing first,
// falls back to AI (Claude) extraction, then saves results and trains patterns.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const VALID_CATEGORIES = [
  "Talent", "Styling", "Equipment Rental", "Studio Space",
  "Post-Production", "Travel", "Catering", "Props",
  "Wardrobe", "Set Design", "Other",
] as const;

type CostCategory = typeof VALID_CATEGORIES[number];

interface ParsedItem {
  category: CostCategory;
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

interface InvoiceFlag {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
}

interface ParseResult {
  items: ParsedItem[];
  vendorName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  total?: number;
  method: "pattern" | "ai";
}

// ── Supabase admin client ──
function getDb() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Download invoice file from private storage ──
async function downloadInvoice(storagePath: string): Promise<Uint8Array> {
  const db = getDb();
  const { data, error } = await db.storage
    .from("invoices")
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download invoice: ${error?.message || "No data"}`);
  }

  return new Uint8Array(await data.arrayBuffer());
}

// ── Get estimate items for comparison ──
async function getEstimateItems(campaignVendorId: string) {
  const db = getDb();
  const { data } = await db
    .from("vendor_estimate_items")
    .select("id, category, description, amount")
    .eq("campaign_vendor_id", campaignVendorId)
    .order("sort_order");

  return data || [];
}

// ── Get vendor ID from campaign_vendor ──
async function getVendorId(campaignVendorId: string): Promise<string | null> {
  const db = getDb();
  const { data } = await db
    .from("campaign_vendors")
    .select("vendor_id")
    .eq("id", campaignVendorId)
    .single();

  return data?.vendor_id || null;
}

// ── Pattern-based parsing ──
async function tryPatternParse(
  vendorId: string,
  fileBytes: Uint8Array
): Promise<ParseResult | null> {
  const db = getDb();

  // Look for active templates for this vendor
  const { data: templates } = await db
    .from("vendor_parse_templates")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("active", true)
    .order("confidence", { ascending: false })
    .limit(1);

  if (!templates || templates.length === 0) return null;

  const template = templates[0];
  const fieldMappings = template.field_mappings as {
    lineItemPattern?: string;
    categoryKeywords?: Record<string, string[]>;
    totalPattern?: string;
    vendorNamePattern?: string;
    invoiceNumberPattern?: string;
    datePattern?: string;
  };

  // Only attempt pattern parsing if confidence is high enough
  if (template.confidence < 70) return null;

  try {
    // Convert file to text (works for text-based PDFs)
    const text = new TextDecoder("utf-8", { fatal: false }).decode(fileBytes);
    if (!text || text.length < 50) return null; // Binary PDF, can't pattern parse

    const items: ParsedItem[] = [];
    let total: number | undefined;

    // Apply line item pattern
    if (fieldMappings.lineItemPattern) {
      const regex = new RegExp(fieldMappings.lineItemPattern, "gm");
      let match;
      while ((match = regex.exec(text)) !== null) {
        const description = match.groups?.description || match[1] || "";
        const amount = parseFloat(
          (match.groups?.amount || match[2] || "0").replace(/[,$]/g, "")
        );
        if (amount > 0 && description) {
          const category = matchCategory(
            description,
            fieldMappings.categoryKeywords || {}
          );
          items.push({ category, description: description.trim(), amount });
        }
      }
    }

    // Apply total pattern
    if (fieldMappings.totalPattern) {
      const totalMatch = text.match(new RegExp(fieldMappings.totalPattern));
      if (totalMatch) {
        total = parseFloat(
          (totalMatch.groups?.total || totalMatch[1] || "0").replace(/[,$]/g, "")
        );
      }
    }

    // Validate: items should roughly sum to total
    if (items.length > 0 && total) {
      const itemSum = items.reduce((s, i) => s + i.amount, 0);
      const tolerance = total * 0.05; // 5% tolerance
      if (Math.abs(itemSum - total) > tolerance) {
        return null; // Pattern didn't parse correctly, fall back to AI
      }
    }

    if (items.length === 0) return null;

    return { items, total, method: "pattern" };
  } catch {
    return null; // Pattern parsing failed, fall back to AI
  }
}

// ── Match description to cost category using keywords ──
function matchCategory(
  description: string,
  keywords: Record<string, string[]>
): CostCategory {
  const lower = description.toLowerCase();
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some((w) => lower.includes(w.toLowerCase()))) {
      if (VALID_CATEGORIES.includes(category as CostCategory)) {
        return category as CostCategory;
      }
    }
  }

  // Fallback keyword matching
  const fallbackMap: Record<string, CostCategory> = {
    photo: "Talent", photographer: "Talent", videograph: "Talent", talent: "Talent",
    day rate: "Talent", creative fee: "Talent",
    styl: "Styling", food styl: "Styling", wardrobe styl: "Styling",
    camera: "Equipment Rental", lens: "Equipment Rental", equipment: "Equipment Rental",
    rental: "Equipment Rental", grip: "Equipment Rental", lighting: "Equipment Rental",
    studio: "Studio Space", stage: "Studio Space", location: "Studio Space",
    retouch: "Post-Production", edit: "Post-Production", color: "Post-Production",
    post: "Post-Production", delivery: "Post-Production",
    travel: "Travel", mileage: "Travel", parking: "Travel", hotel: "Travel",
    flight: "Travel", transport: "Travel",
    catering: "Catering", craft: "Catering", meal: "Catering", food service: "Catering",
    prop: "Props", supplies: "Props",
    wardrobe: "Wardrobe", costume: "Wardrobe", apron: "Wardrobe",
    set: "Set Design", build: "Set Design", construct: "Set Design",
    backdrop: "Set Design", dressing: "Set Design",
  };

  for (const [keyword, category] of Object.entries(fallbackMap)) {
    if (lower.includes(keyword)) return category;
  }

  return "Other";
}

// ── AI-based parsing via Claude ──
async function aiParse(fileBytes: Uint8Array, fileName: string): Promise<ParseResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Determine media type
  const ext = fileName.toLowerCase().split(".").pop();
  let mediaType = "application/pdf";
  if (ext === "png") mediaType = "image/png";
  else if (ext === "jpg" || ext === "jpeg") mediaType = "image/jpeg";
  else if (ext === "webp") mediaType = "image/webp";

  const base64Data = btoa(
    String.fromCharCode(...fileBytes)
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: `Extract all line items from this invoice. Return valid JSON only, no other text.

Format:
{
  "vendorName": "string",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "total": number,
  "items": [
    {
      "description": "string — exact text from invoice",
      "amount": number,
      "quantity": number or null,
      "unitPrice": number or null,
      "category": "one of: ${VALID_CATEGORIES.join(", ")}"
    }
  ]
}

Rules:
- Every amount should be a positive number (no negative values)
- Category must be exactly one of the listed values
- If you can't determine the category, use "Other"
- Include ALL line items, even small ones
- The items should sum to approximately the total
- Use the description exactly as written on the invoice`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} — ${errText}`);
  }

  const result = await response.json();
  const content = result.content?.[0]?.text || "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in AI response");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and normalize categories
  const items: ParsedItem[] = (parsed.items || []).map((item: Record<string, unknown>) => ({
    description: String(item.description || ""),
    amount: Math.abs(Number(item.amount) || 0),
    quantity: item.quantity ? Number(item.quantity) : undefined,
    unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
    category: VALID_CATEGORIES.includes(item.category as CostCategory)
      ? (item.category as CostCategory)
      : matchCategory(String(item.description || ""), {}),
  }));

  return {
    items: items.filter((i) => i.amount > 0),
    vendorName: parsed.vendorName || undefined,
    invoiceNumber: parsed.invoiceNumber || undefined,
    invoiceDate: parsed.invoiceDate || undefined,
    total: parsed.total ? Number(parsed.total) : undefined,
    method: "ai",
  };
}

// ── Train / update pattern template from AI parse result ──
async function trainTemplate(
  vendorId: string,
  parseResult: ParseResult,
  fileText: string
): Promise<void> {
  if (!ANTHROPIC_API_KEY) return;

  const db = getDb();

  // Check for existing template
  const { data: existing } = await db
    .from("vendor_parse_templates")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("active", true)
    .limit(1);

  if (existing && existing.length > 0) {
    // Update existing template — increment training count and confidence
    const template = existing[0];
    const newCount = (template.training_count || 1) + 1;
    const newConfidence = Math.min(95, (template.confidence || 50) + 5);

    await db
      .from("vendor_parse_templates")
      .update({
        training_count: newCount,
        confidence: newConfidence,
        sample_output: {
          items: parseResult.items,
          vendorName: parseResult.vendorName,
          total: parseResult.total,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", template.id);

    return;
  }

  // Generate pattern template from AI — ask Claude to create regex patterns
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `Given this invoice text, generate regex patterns that could parse future invoices from the same vendor.

Invoice text (first 2000 chars):
${fileText.slice(0, 2000)}

Extracted items:
${JSON.stringify(parseResult.items, null, 2)}

Return valid JSON only:
{
  "lineItemPattern": "regex pattern with named groups (?<description>...) and (?<amount>...) to match line items",
  "totalPattern": "regex pattern with named group (?<total>...) to match the invoice total",
  "categoryKeywords": {
    "Talent": ["keyword1", "keyword2"],
    "Styling": ["keyword1"],
    ...only include categories that appear in this invoice
  }
}

Rules:
- Patterns should be general enough to match future invoices from the same vendor
- Use named capture groups
- Escape special regex characters properly
- categoryKeywords should map category names to arrays of lowercase keywords found in descriptions`,
          },
        ],
      }),
    });

    if (!response.ok) return;

    const result = await response.json();
    const content = result.content?.[0]?.text || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const fieldMappings = JSON.parse(jsonMatch[0]);

    // Save new template
    await db.from("vendor_parse_templates").insert({
      vendor_id: vendorId,
      template_name: parseResult.vendorName || "Auto-generated",
      field_mappings: fieldMappings,
      sample_output: {
        items: parseResult.items,
        vendorName: parseResult.vendorName,
        total: parseResult.total,
      },
      training_count: 1,
      confidence: 50,
      active: true,
    });
  } catch {
    // Template training is non-critical — don't fail the parse
  }
}

// ── Match invoice items to estimate items ──
function matchToEstimates(
  parsedItems: ParsedItem[],
  estimateItems: Array<{ id: string; category: string; description: string; amount: number }>
): Array<{
  category: CostCategory;
  description: string;
  amount: number;
  matchedEstimateItemId: string | null;
  flagged: boolean;
  flagReason: string;
}> {
  const usedEstimates = new Set<string>();

  return parsedItems.map((item) => {
    // Find best matching estimate item (same category, closest amount)
    let bestMatch: typeof estimateItems[0] | null = null;
    let bestScore = -1;

    for (const est of estimateItems) {
      if (usedEstimates.has(est.id)) continue;

      let score = 0;
      // Category match is worth the most
      if (est.category === item.category) score += 10;
      // Description similarity
      const descWords = item.description.toLowerCase().split(/\s+/);
      const estWords = est.description.toLowerCase().split(/\s+/);
      const overlap = descWords.filter((w) => estWords.includes(w)).length;
      score += overlap * 2;
      // Amount proximity (within 30% is a reasonable match)
      const amtDiff = Math.abs(item.amount - est.amount) / Math.max(est.amount, 1);
      if (amtDiff < 0.3) score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = est;
      }
    }

    // Require minimum score to match
    const matched = bestScore >= 5 ? bestMatch : null;
    if (matched) usedEstimates.add(matched.id);

    // Flag logic
    let flagged = false;
    let flagReason = "";

    if (matched) {
      const diff = item.amount - matched.amount;
      const diffPct = (diff / matched.amount) * 100;
      if (diffPct > 10) {
        flagged = true;
        flagReason = `Over estimate by ${diffPct.toFixed(0)}% ($${diff.toFixed(2)})`;
      }
    } else {
      // No matching estimate item — flag as new line
      if (item.amount > 100) {
        flagged = true;
        flagReason = "No matching estimate line item";
      }
    }

    return {
      category: item.category,
      description: item.description,
      amount: item.amount,
      matchedEstimateItemId: matched?.id || null,
      flagged,
      flagReason,
    };
  });
}

// ── Generate auto-flags for the invoice ──
function generateFlags(
  parsedItems: ParsedItem[],
  estimateItems: Array<{ amount: number }>,
  parseResult: ParseResult
): InvoiceFlag[] {
  const flags: InvoiceFlag[] = [];
  const invoiceTotal = parsedItems.reduce((s, i) => s + i.amount, 0);
  const estimateTotal = estimateItems.reduce((s, i) => s + i.amount, 0);

  // Total comparison
  if (estimateTotal > 0) {
    const totalDiff = invoiceTotal - estimateTotal;
    const totalDiffPct = (totalDiff / estimateTotal) * 100;

    if (totalDiffPct > 15) {
      flags.push({
        type: "Total Over Estimate",
        severity: "high",
        message: `Invoice total ($${invoiceTotal.toFixed(2)}) is ${totalDiffPct.toFixed(0)}% over the estimate ($${estimateTotal.toFixed(2)}).`,
      });
    } else if (totalDiffPct > 5) {
      flags.push({
        type: "Total Over Estimate",
        severity: "medium",
        message: `Invoice total is ${totalDiffPct.toFixed(0)}% over the estimate.`,
      });
    }
  }

  // New line items not in estimate
  const newItems = parsedItems.filter(
    (item) => !estimateItems.some((e) => e.amount === item.amount)
  );
  if (newItems.length > 0) {
    flags.push({
      type: "New Line Items",
      severity: "medium",
      message: `${newItems.length} line item(s) don't have a direct estimate match.`,
    });
  }

  // Parse method notice
  if (parseResult.method === "pattern") {
    flags.push({
      type: "Pattern Parsed",
      severity: "low",
      message: "This invoice was parsed using learned patterns. Review items for accuracy.",
    });
  }

  return flags;
}

// ── Main handler ──
Deno.serve(async (req) => {
  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { invoiceId, storagePath, campaignVendorId } = await req.json();

    if (!invoiceId || !storagePath || !campaignVendorId) {
      return new Response(
        JSON.stringify({ error: "invoiceId, storagePath, and campaignVendorId required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const db = getDb();

    // Mark as processing
    await db
      .from("vendor_invoices")
      .update({ parse_status: "processing" })
      .eq("id", invoiceId);

    // Download invoice from private storage
    const fileBytes = await downloadInvoice(storagePath);

    // Get vendor ID and estimate items
    const vendorId = await getVendorId(campaignVendorId);
    const estimateItems = await getEstimateItems(campaignVendorId);

    // Get file name for type detection
    const { data: invoiceRecord } = await db
      .from("vendor_invoices")
      .select("file_name")
      .eq("id", invoiceId)
      .single();
    const fileName = invoiceRecord?.file_name || "invoice.pdf";

    // Step 1: Try pattern-based parsing first
    let parseResult: ParseResult | null = null;
    if (vendorId) {
      parseResult = await tryPatternParse(vendorId, fileBytes);
    }

    // Step 2: Fall back to AI parsing
    if (!parseResult) {
      parseResult = await aiParse(fileBytes, fileName);
    }

    // Step 3: Match to estimates and flag discrepancies
    const matchedItems = matchToEstimates(parseResult.items, estimateItems);
    const autoFlags = generateFlags(parseResult.items, estimateItems, parseResult);

    // Step 4: Save results
    // Update invoice record
    const { error: updateErr } = await db
      .from("vendor_invoices")
      .update({
        parsed_data: {
          vendorName: parseResult.vendorName,
          invoiceNumber: parseResult.invoiceNumber,
          invoiceDate: parseResult.invoiceDate,
          total: parseResult.total,
          parseMethod: parseResult.method,
          itemCount: matchedItems.length,
        },
        auto_flags: autoFlags,
        parse_status: "completed",
        parsed_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (updateErr) throw updateErr;

    // Insert parsed line items
    if (matchedItems.length > 0) {
      const rows = matchedItems.map((item, i) => ({
        invoice_id: invoiceId,
        category: item.category,
        description: item.description,
        amount: item.amount,
        matched_estimate_item_id: item.matchedEstimateItemId,
        flagged: item.flagged,
        flag_reason: item.flagReason,
        sort_order: i,
      }));

      const { error: insertErr } = await db
        .from("vendor_invoice_items")
        .insert(rows);

      if (insertErr) throw insertErr;
    }

    // Update campaign_vendors.invoice_total
    const invoiceTotal = matchedItems.reduce((s, i) => s + i.amount, 0);
    await db
      .from("campaign_vendors")
      .update({ invoice_total: invoiceTotal })
      .eq("id", campaignVendorId);

    // Step 5: Train pattern template from AI result (non-blocking)
    if (parseResult.method === "ai" && vendorId) {
      const fileText = new TextDecoder("utf-8", { fatal: false }).decode(fileBytes);
      // Don't await — training is non-critical
      trainTemplate(vendorId, parseResult, fileText).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        method: parseResult.method,
        itemCount: matchedItems.length,
        total: invoiceTotal,
        flagCount: autoFlags.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Mark as failed
    try {
      const { invoiceId } = await req.clone().json().catch(() => ({}));
      if (invoiceId) {
        const db = getDb();
        await db
          .from("vendor_invoices")
          .update({ parse_status: "failed" })
          .eq("id", invoiceId);
      }
    } catch { /* ignore cleanup errors */ }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Invoice parse failed:", message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
