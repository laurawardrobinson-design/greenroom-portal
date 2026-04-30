// Build a review file for every product so Laura can confirm/paste the
// correct publix.com URL for each one. Output is a markdown table with:
//
//   - Product name and department
//   - Current item_code and pcom_link (if any)
//   - A "Search on Publix" URL — opens publix.com search prefilled with
//     the product name, so the reviewer can find the real PDP in one click
//   - An empty "Confirmed URL" column for the reviewer to fill in
//
// After Laura fills the file in, the companion script
// `ingest-confirmed-product-links.mjs` reads it and pulls real
// item_code, description, and image for each row.
//
// Run with:
//   node --env-file=portal-v2/.env.local portal-v2/scripts/build-product-link-review.mjs

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: products, error } = await admin
  .from("products")
  .select("id, name, department, item_code, pcom_link, image_url")
  .order("department", { ascending: true })
  .order("name", { ascending: true });
if (error) {
  console.error("read failed:", error);
  process.exit(1);
}

const rows = products ?? [];
mkdirSync("portal-v2/scripts/.review", { recursive: true });
const out = "portal-v2/scripts/.review/product-links.md";

const lines = [];
lines.push("# Product link review");
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Total products: ${rows.length}`);
lines.push("");
lines.push("**How to use this file:**");
lines.push("1. For each row, click **Search Publix** to find the real product on publix.com.");
lines.push("2. Copy the product page URL (looks like `https://www.publix.com/pd/<slug>/RIO-...`).");
lines.push("3. Paste it into the **Confirmed URL** column. Leave blank to skip.");
lines.push("4. Save and tell Claude to run `ingest-confirmed-product-links.mjs`.");
lines.push("");
lines.push("Once a Confirmed URL is filled, the ingest script will pull real");
lines.push("`item_code`, `image_url`, and (if available) `pcom_link` from that page.");
lines.push("Description is **not** auto-filled — your team enters it manually.");
lines.push("");
lines.push("| # | Name | Department | Current item_code | Current pcom_link | Search Publix | Confirmed URL |");
lines.push("|---|------|------------|-------------------|-------------------|---------------|---------------|");

rows.forEach((p, i) => {
  const name = (p.name ?? "").replace(/\|/g, "\\|");
  const dept = p.department ?? "";
  const itemCode = p.item_code ?? "";
  const pcom = p.pcom_link ? `[link](${p.pcom_link})` : "";
  const search = `https://www.publix.com/search?search=${encodeURIComponent(p.name ?? "")}`;
  const searchCell = `[Search Publix](${search})`;
  lines.push(
    `| ${i + 1} | ${name} | ${dept} | ${itemCode} | ${pcom} | ${searchCell} |  |`
  );
});

writeFileSync(out, lines.join("\n") + "\n");
console.log(`Wrote ${rows.length} rows → ${out}`);
console.log("Open it in any markdown viewer and start filling in Confirmed URLs.");
