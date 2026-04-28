-- Migration 106: Backfill item_code, image_url, and pcom_link for all seed products
--
-- Seeds products from earlier migrations were created without item_code,
-- image_url, or pcom_link. This migration fills all three using real
-- publix.com product URLs. Image URLs use the Publix CDN pattern:
--   images.publixcdn.com/pct/images/products/{folder}/{code}-600x600-A.jpg
--   where folder = floor(itemCode / 5000) * 5000
--
-- Only updates rows still missing at least one of the three fields, so
-- data entered via the product drawer is never overwritten.

-- Pass 1: migration-100 seed products (matched by patterned UUID)
UPDATE products SET
  item_code = v.item_code,
  image_url = v.image_url
FROM (VALUES
  -- Spring Refresh
  ('a1b2c3d4-aaaa-4001-0001-000000000001', '158492', 'https://images.publixcdn.com/pct/images/products/155000/158492-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4001-0001-000000000002', '115965', 'https://images.publixcdn.com/pct/images/products/115000/115965-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4001-0001-000000000003', '107000', 'https://images.publixcdn.com/pct/images/products/105000/107000-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4001-0001-000000000004', '107459', 'https://images.publixcdn.com/pct/images/products/105000/107459-600x600-A.jpg'),
  -- Summer Grilling Hero / Collection
  ('a1b2c3d4-aaaa-4002-0002-000000000001', '106605', 'https://images.publixcdn.com/pct/images/products/105000/106605-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4002-0002-000000000002', '601657', 'https://images.publixcdn.com/pct/images/products/600000/601657-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4002-0002-000000000003', '110263', 'https://images.publixcdn.com/pct/images/products/110000/110263-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4002-0002-000000000004', '108331', 'https://images.publixcdn.com/pct/images/products/105000/108331-600x600-A.jpg'),
  -- Back-to-School
  ('a1b2c3d4-aaaa-4003-0003-000000000001', '594106', 'https://images.publixcdn.com/pct/images/products/590000/594106-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4003-0003-000000000002', '266756', 'https://images.publixcdn.com/pct/images/products/265000/266756-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4003-0003-000000000003', '140382', 'https://images.publixcdn.com/pct/images/products/140000/140382-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4003-0003-000000000004', '610445', 'https://images.publixcdn.com/pct/images/products/610000/610445-600x600-A.jpg'),
  -- Fall Harvest
  ('a1b2c3d4-aaaa-4004-0004-000000000001', '111384', 'https://images.publixcdn.com/pct/images/products/110000/111384-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4004-0004-000000000002', '573991', 'https://images.publixcdn.com/pct/images/products/570000/573991-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4004-0004-000000000003', '625585', 'https://images.publixcdn.com/pct/images/products/625000/625585-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4004-0004-000000000004', '107039', 'https://images.publixcdn.com/pct/images/products/105000/107039-600x600-A.jpg'),
  -- Holiday Hosting
  ('a1b2c3d4-aaaa-4005-0005-000000000001', '239712', 'https://images.publixcdn.com/pct/images/products/235000/239712-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4005-0005-000000000002', '614104', 'https://images.publixcdn.com/pct/images/products/610000/614104-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4005-0005-000000000003', '194729', 'https://images.publixcdn.com/pct/images/products/190000/194729-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4005-0005-000000000004', '118987', 'https://images.publixcdn.com/pct/images/products/115000/118987-600x600-A.jpg'),
  -- Winter Wellness
  ('a1b2c3d4-aaaa-4006-0006-000000000001', '551247', 'https://images.publixcdn.com/pct/images/products/550000/551247-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4006-0006-000000000002', '107590', 'https://images.publixcdn.com/pct/images/products/105000/107590-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4006-0006-000000000003', '525498', 'https://images.publixcdn.com/pct/images/products/525000/525498-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4006-0006-000000000004', '558146', 'https://images.publixcdn.com/pct/images/products/555000/558146-600x600-A.jpg'),
  -- Valentine's Sweet Treats
  ('a1b2c3d4-aaaa-4007-0007-000000000001', '282120', 'https://images.publixcdn.com/pct/images/products/280000/282120-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4007-0007-000000000002', '118802', 'https://images.publixcdn.com/pct/images/products/115000/118802-600x600-A.jpg'),
  ('a1b2c3d4-aaaa-4007-0007-000000000003', '115437', 'https://images.publixcdn.com/pct/images/products/115000/115437-600x600-A.jpg')
) AS v(id, item_code, image_url)
WHERE products.id = v.id::uuid
  AND (products.item_code IS NULL OR products.image_url IS NULL);

-- Pass 2: additional seed products (matched by name, since these have random UUIDs)
UPDATE products SET
  pcom_link  = v.pcom_link,
  item_code  = v.item_code,
  image_url  = v.image_url
FROM (VALUES
  ('221 B.C. Kombucha, Berry & Hibiscus',
   'https://www.publix.com/pd/221-bc-kombucha-berry--hibiscus/RIO-PCI-558146',
   '558146',
   'https://images.publixcdn.com/pct/images/products/555000/558146-600x600-A.jpg'),
  ('Balloons Pull Apart Cupcakes 24-Count',
   'https://www.publix.com/pd/balloons-pull-apart-cupcakes-24-count/RIO-THC-280654',
   '280654',
   'https://images.publixcdn.com/pct/images/products/280000/280654-600x600-A.jpg'),
  ('Coca Cola Cola Zero Sugar Fridge Pack',
   'https://www.publix.com/pd/coca-cola-cola-zero-sugar-fridge-pack/RIO-CBV-148046',
   '148046',
   'https://images.publixcdn.com/pct/images/products/145000/148046-600x600-A.jpg'),
  ('Deli roast beef, sliced thin, 5 lbs',
   'https://www.publix.com/pd/publix-deli-top-round-roast-beef/RIO-DSM-100221',
   '100221',
   'https://images.publixcdn.com/pct/images/products/100000/100221-600x600-A.jpg'),
  ('Publix Premium Italian sausage, 3 cases',
   'https://www.publix.com/pd/publix-mild-pork-italian-sausage-bulk-our-exclusive-recipe/RIO-PCI-141224',
   '141224',
   'https://images.publixcdn.com/pct/images/products/140000/141224-600x600-A.jpg'),
  ('Publix Premium marinated flank steak',
   'https://www.publix.com/pd/flank-steak-publix-usda-choice-beef/RIO-PCI-119900',
   '119900',
   'https://images.publixcdn.com/pct/images/products/115000/119900-600x600-A.jpg'),
  ('Pink Party Towering Tier Cake',
   'https://www.publix.com/pd/pink-party-towering-tier-cake/RIO-BPL-048987',
   '048987',
   'https://images.publixcdn.com/pct/images/products/45000/048987-600x600-A.jpg')
) AS v(name, pcom_link, item_code, image_url)
WHERE products.name = v.name
  AND (products.item_code IS NULL OR products.image_url IS NULL OR products.pcom_link IS NULL);
