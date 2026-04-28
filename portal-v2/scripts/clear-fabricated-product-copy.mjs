// Wipe products.description for every product, after backing up to a JSON
// file so nothing is destroyed. Fabricated marketing copy was found in the
// products table and we cannot tell by inspection which descriptions are
// real vs. AI-invented, so we clear all of them. Real copy can be re-entered
// by the team via the product drawer.
//
// Run with:
//   node --env-file=portal-v2/.env.local portal-v2/scripts/clear-fabricated-product-copy.mjs

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: products, error } = await admin
  .from("products")
  .select("id, name, item_code, description")
  .neq("description", "");
if (error) {
  console.error("read failed:", error);
  process.exit(1);
}

const targets = (products ?? []).filter((p) => (p.description ?? "").trim().length > 0);
console.log(`Found ${targets.length} products with non-empty descriptions.`);

if (targets.length === 0) {
  console.log("Nothing to clear.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("portal-v2/scripts/.backups", { recursive: true });
const backupPath = `portal-v2/scripts/.backups/product-descriptions-${stamp}.json`;
writeFileSync(backupPath, JSON.stringify(targets, null, 2));
console.log(`Backup written: ${backupPath}`);

const ids = targets.map((p) => p.id);
const { error: updErr, count } = await admin
  .from("products")
  .update({ description: "" }, { count: "exact" })
  .in("id", ids);
if (updErr) {
  console.error("update failed:", updErr);
  process.exit(1);
}
console.log(`Cleared ${count ?? targets.length} descriptions.`);
console.log(
  "Restore any of them by reading the backup JSON and pasting real copy into the product drawer."
);
