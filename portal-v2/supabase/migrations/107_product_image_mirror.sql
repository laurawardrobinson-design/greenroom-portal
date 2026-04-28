-- Migration 107: Product image mirror — decouple from publix.com
--
-- Until now product images were hotlinked from images.publixcdn.com. When
-- Publix renamed/retired/moved a product, our images broke. This migration
-- adds a source_image_url column to preserve the original Publix URL, and
-- the accompanying backfill script (scripts/mirror-product-images.mjs)
-- mirrors each image into the existing brand-assets bucket and rewrites
-- products.image_url to point at our own Supabase Storage.
--
-- After backfill, products.image_url is always served from our infrastructure.
-- products.source_image_url keeps the Publix original so we can re-mirror
-- on demand if a higher-resolution copy becomes available.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_image_url TEXT;

COMMENT ON COLUMN products.source_image_url IS
  'Original external image URL (e.g. publix CDN). image_url is the mirrored copy in brand-assets/products/.';

-- Seed source_image_url from any current publix CDN URLs so the backfill
-- script knows where to fetch the original. Idempotent.
UPDATE products
   SET source_image_url = image_url
 WHERE source_image_url IS NULL
   AND image_url LIKE 'https://images.publixcdn.com/%';
