#!/usr/bin/env node

/**
 * One-time sync: Read product images from DAM assets and populate products.image_url
 *
 * Safe operation: only UPDATEs products where image_url is NULL and a matching DAM asset exists.
 * Does not modify DAM tables at all.
 *
 * Usage: npx ts-node scripts/sync-dam-images-to-products.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function syncDamImagesToProducts() {
  console.log("Starting DAM-to-products image sync...\n");

  try {
    // Get all products with item_code but no image_url
    const { data: productsNeedingImages, error: fetchError } = await db
      .from("products")
      .select("id, name, item_code")
      .eq("image_url", null)
      .not("item_code", "is", null);

    if (fetchError) throw fetchError;

    console.log(`Found ${productsNeedingImages?.length ?? 0} products needing images\n`);

    let synced = 0;
    let notFound = 0;

    for (const product of productsNeedingImages ?? []) {
      // Find the oldest DAM asset for this product SKU
      const { data: damAssets, error: damError } = await db
        .from("dam_asset_products")
        .select("dam_asset_id, dam_assets(id, image_url, created_at)")
        .eq("product_sku", product.item_code)
        .order("dam_assets(created_at)", { ascending: true })
        .limit(1)
        .single();

      if (damError || !damAssets?.dam_assets) {
        console.log(`  ✗ ${product.name} (${product.item_code}) — no DAM assets found`);
        notFound++;
        continue;
      }

      const imageUrl = (damAssets.dam_assets as any)?.image_url;
      if (!imageUrl) {
        console.log(`  ✗ ${product.name} (${product.item_code}) — DAM asset has no image_url`);
        notFound++;
        continue;
      }

      // Update product with the DAM image
      const { error: updateError } = await db
        .from("products")
        .update({ image_url: imageUrl })
        .eq("id", product.id);

      if (updateError) {
        console.log(`  ✗ ${product.name} — UPDATE failed: ${updateError.message}`);
        continue;
      }

      console.log(`  ✓ ${product.name} (${product.item_code}) — synced from DAM`);
      synced++;
    }

    console.log(`\n=== Results ===`);
    console.log(`Synced: ${synced}`);
    console.log(`Not found: ${notFound}`);
    console.log(`Total: ${synced + notFound}`);

    if (synced > 0) {
      console.log(`\n✓ Successfully synced ${synced} product images from DAM`);
    }
  } catch (error) {
    console.error("Error during sync:", error);
    process.exit(1);
  }
}

syncDamImagesToProducts();
