-- Migration 100: Reseed campaign dates + Publix product catalog
--
-- Goal: push every existing campaign's shoot dates forward relative to today,
-- reposition each campaign at a stage that gives every test-user role meaningful
-- in-flight work, and seed a real Publix product catalog with hero/secondary
-- linkage on every campaign. No campaigns are deleted — only renamed/restaged.
--
-- Date strategy: all shoot dates use CURRENT_DATE + interval so the data stays
-- evergreen across re-applies. Run again later and Spring Refresh will still be
-- "two weeks out", Summer Grilling still "this week", etc.
--
-- Stage matrix (post-migration):
--   Spring Refresh ............... Planning   (prominent, concept deck attached)
--   Summer Grilling Hero ......... In Production (shooting this week)
--   Back-to-School Lunchbox ...... In Production (just shot, in post)
--   Fall Harvest Baking .......... Upcoming   (3 weeks out)
--   Holiday Hosting (renamed) .... Planning   (60 days out)
--   Plant-Based Meat Showcase .... In Production
--   Bakery Section Remodel ....... Post
--   Summer Grilling Collection ... Upcoming   (Producer's secondary queue)
--   Spring Organic Pasta Launch .. Planning
--   Organic Produce Campaign ..... In Production
--   Customer Testimonial Series .. Planning
--   Winter Wellness (NEW) ........ Planning   (early, no shoots yet)
--   Valentine's Sweet Treats (NEW) Complete  (historical)

BEGIN;

-- ============================================================================
-- Section 1: Restage existing campaigns (rename + status + assignments)
-- ============================================================================

-- Spring Produce Hero → Spring Refresh (prominent Planning, concept deck campaign)
UPDATE campaigns SET
  name = 'Spring Refresh',
  status = 'Planning',
  art_director_id = '95f879cc-1d60-42d0-a5c4-7cf183271dbc', -- Alex Rivera
  producer_id = '4e9eca0c-eb47-42f9-81f4-a1e005e96fad',     -- Laura Robinson
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',  -- Nicole Lee (BMM)
  headline = 'Bright, fresh, ready for the season',
  cta = 'Find your spring at Publix',
  notes = 'Hero produce moment for the Spring quarter. Concept deck approved by CD.',
  assets_delivery_date = CURRENT_DATE + INTERVAL '45 days'
WHERE id = '6e5bfb11-91f6-4472-a298-b98f925b6b6b';

-- Summer Grilling Hero — shooting this week
UPDATE campaigns SET
  status = 'In Production',
  art_director_id = '95f879cc-1d60-42d0-a5c4-7cf183271dbc',
  producer_id = '4e9eca0c-eb47-42f9-81f4-a1e005e96fad',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  headline = 'Fire it up',
  assets_delivery_date = CURRENT_DATE + INTERVAL '21 days'
WHERE id = 'a1b2c3d4-1111-4aaa-bbbb-000000000001';

-- Back-to-School Lunchbox — just shot, now in post
UPDATE campaigns SET
  status = 'In Production',
  art_director_id = 'f1ef5a0b-ae3f-4b0e-8280-e8fb67ac5e29', -- Sarah Lindgren
  producer_id = '51a2fa4c-3206-45bf-9fe4-2239282ff116',     -- Miles Nakamura
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  headline = 'Lunchbox love, every day',
  assets_delivery_date = CURRENT_DATE + INTERVAL '14 days'
WHERE id = 'a1b2c3d4-2222-4aaa-bbbb-000000000002';

-- Fall Harvest Baking — Upcoming, 3 weeks out
UPDATE campaigns SET
  status = 'Upcoming',
  art_director_id = 'f1ef5a0b-ae3f-4b0e-8280-e8fb67ac5e29',
  producer_id = '51a2fa4c-3206-45bf-9fe4-2239282ff116',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  headline = 'Cozy season starts here',
  assets_delivery_date = CURRENT_DATE + INTERVAL '60 days'
WHERE id = 'a1b2c3d4-3333-4aaa-bbbb-000000000003';

-- Holiday Promotion 2026 → Holiday Hosting
UPDATE campaigns SET
  name = 'Holiday Hosting',
  status = 'Planning',
  art_director_id = 'f1ef5a0b-ae3f-4b0e-8280-e8fb67ac5e29',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  headline = 'A table everyone remembers',
  notes = 'Q4 hero. Vendor sourcing in progress; concept review in 3 weeks.',
  assets_delivery_date = CURRENT_DATE + INTERVAL '120 days'
WHERE id = '7d683373-cb3e-40f2-bd84-c7786341694d';

-- Plant-Based Meat Showcase
UPDATE campaigns SET
  status = 'In Production',
  art_director_id = '95f879cc-1d60-42d0-a5c4-7cf183271dbc',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  assets_delivery_date = CURRENT_DATE + INTERVAL '50 days'
WHERE id = '9dcb0fc3-860a-46f4-b220-9b58f7f21c7d';

-- Bakery Section Remodel
UPDATE campaigns SET
  status = 'Post',
  art_director_id = 'f1ef5a0b-ae3f-4b0e-8280-e8fb67ac5e29',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  assets_delivery_date = CURRENT_DATE + INTERVAL '7 days'
WHERE id = '7318c8f3-aba4-48df-89ac-819141aece0f';

-- Summer Grilling Collection — Upcoming secondary queue
UPDATE campaigns SET
  status = 'Upcoming',
  producer_id = '4e9eca0c-eb47-42f9-81f4-a1e005e96fad',
  art_director_id = '95f879cc-1d60-42d0-a5c4-7cf183271dbc',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  assets_delivery_date = CURRENT_DATE + INTERVAL '40 days'
WHERE id = '82e4710f-9815-4ea2-b128-ee0b0459014b';

-- Spring Organic Pasta Launch
UPDATE campaigns SET
  status = 'Planning',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  assets_delivery_date = CURRENT_DATE + INTERVAL '75 days'
WHERE id = '07c8ba2c-d282-4a5c-8bc8-e569a4cf5eef';

-- Organic Produce Campaign
UPDATE campaigns SET
  status = 'In Production',
  art_director_id = '95f879cc-1d60-42d0-a5c4-7cf183271dbc',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  assets_delivery_date = CURRENT_DATE + INTERVAL '28 days'
WHERE id = '8cd09a3b-4a5a-4b7a-ace9-523f15ea298a';

-- Customer Testimonial Series
UPDATE campaigns SET
  status = 'Planning',
  art_director_id = '95f879cc-1d60-42d0-a5c4-7cf183271dbc',
  brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
  assets_delivery_date = CURRENT_DATE + INTERVAL '90 days'
WHERE id = '33dce958-87ef-440b-b795-6255449cc601';

-- ============================================================================
-- Section 2: Reset shoot dates (push everything forward relative to today)
-- ============================================================================
-- Strategy: UPDATE existing shoot_date rows in place by ROW_NUMBER, so we
-- preserve IDs and any FKs from PRDocs, call sheets, etc. New shoots/dates
-- get inserted only where the campaign needs additional days.

-- Spring Refresh: 3 existing dates → +14, +15, +16 days
WITH ranked AS (
  SELECT sd.id, ROW_NUMBER() OVER (ORDER BY sd.shoot_date, sd.id) AS rn
  FROM shoot_dates sd JOIN shoots s ON s.id = sd.shoot_id
  WHERE s.campaign_id = '6e5bfb11-91f6-4472-a298-b98f925b6b6b'
)
UPDATE shoot_dates SET shoot_date = CASE ranked.rn
  WHEN 1 THEN CURRENT_DATE + 14
  WHEN 2 THEN CURRENT_DATE + 15
  ELSE CURRENT_DATE + 16
END
FROM ranked WHERE shoot_dates.id = ranked.id;

-- Summer Grilling Hero: 3 existing → +3, +4, +5 (this week!)
WITH ranked AS (
  SELECT sd.id, ROW_NUMBER() OVER (ORDER BY sd.shoot_date, sd.id) AS rn
  FROM shoot_dates sd JOIN shoots s ON s.id = sd.shoot_id
  WHERE s.campaign_id = 'a1b2c3d4-1111-4aaa-bbbb-000000000001'
)
UPDATE shoot_dates SET shoot_date = CASE ranked.rn
  WHEN 1 THEN CURRENT_DATE + 3
  WHEN 2 THEN CURRENT_DATE + 4
  ELSE CURRENT_DATE + 5
END
FROM ranked WHERE shoot_dates.id = ranked.id;

-- Back-to-School: 3 existing → -7, -6, -5 (just shot, now in post)
WITH ranked AS (
  SELECT sd.id, ROW_NUMBER() OVER (ORDER BY sd.shoot_date, sd.id) AS rn
  FROM shoot_dates sd JOIN shoots s ON s.id = sd.shoot_id
  WHERE s.campaign_id = 'a1b2c3d4-2222-4aaa-bbbb-000000000002'
)
UPDATE shoot_dates SET shoot_date = CASE ranked.rn
  WHEN 1 THEN CURRENT_DATE - 7
  WHEN 2 THEN CURRENT_DATE - 6
  ELSE CURRENT_DATE - 5
END
FROM ranked WHERE shoot_dates.id = ranked.id;

-- Fall Harvest Baking: 2 existing → +21, +22
WITH ranked AS (
  SELECT sd.id, ROW_NUMBER() OVER (ORDER BY sd.shoot_date, sd.id) AS rn
  FROM shoot_dates sd JOIN shoots s ON s.id = sd.shoot_id
  WHERE s.campaign_id = 'a1b2c3d4-3333-4aaa-bbbb-000000000003'
)
UPDATE shoot_dates SET shoot_date = CASE ranked.rn
  WHEN 1 THEN CURRENT_DATE + 21
  ELSE CURRENT_DATE + 22
END
FROM ranked WHERE shoot_dates.id = ranked.id;

-- Summer Grilling Collection: 3 existing → +35, +36, +37
WITH ranked AS (
  SELECT sd.id, ROW_NUMBER() OVER (ORDER BY sd.shoot_date, sd.id) AS rn
  FROM shoot_dates sd JOIN shoots s ON s.id = sd.shoot_id
  WHERE s.campaign_id = '82e4710f-9815-4ea2-b128-ee0b0459014b'
)
UPDATE shoot_dates SET shoot_date = CASE ranked.rn
  WHEN 1 THEN CURRENT_DATE + 35
  WHEN 2 THEN CURRENT_DATE + 36
  ELSE CURRENT_DATE + 37
END
FROM ranked WHERE shoot_dates.id = ranked.id;

-- Plant-Based Meat Showcase: existing dates → +1 (shooting tomorrow, In Production)
UPDATE shoot_dates SET shoot_date = CURRENT_DATE + 1
WHERE shoot_id IN (SELECT id FROM shoots WHERE campaign_id = '9dcb0fc3-860a-46f4-b220-9b58f7f21c7d');

-- Bakery Section Remodel (Post): existing → -21 (shot 3 weeks ago)
UPDATE shoot_dates SET shoot_date = CURRENT_DATE - 21
WHERE shoot_id IN (SELECT id FROM shoots WHERE campaign_id = '7318c8f3-aba4-48df-89ac-819141aece0f');

-- Organic Produce Campaign: existing → +7 (shooting next week)
UPDATE shoot_dates SET shoot_date = CURRENT_DATE + 7
WHERE shoot_id IN (SELECT id FROM shoots WHERE campaign_id = '8cd09a3b-4a5a-4b7a-ace9-523f15ea298a');

-- Holiday Hosting: existing → +60 (planning, 2 months out)
UPDATE shoot_dates SET shoot_date = CURRENT_DATE + 60
WHERE shoot_id IN (SELECT id FROM shoots WHERE campaign_id = '7d683373-cb3e-40f2-bd84-c7786341694d');

-- Spring Organic Pasta Launch: existing → +75
UPDATE shoot_dates SET shoot_date = CURRENT_DATE + 75
WHERE shoot_id IN (SELECT id FROM shoots WHERE campaign_id = '07c8ba2c-d282-4a5c-8bc8-e569a4cf5eef');

-- Customer Testimonial Series: existing → +90 (no concrete dates yet for Planning)
UPDATE shoot_dates SET shoot_date = CURRENT_DATE + 90
WHERE shoot_id IN (SELECT id FROM shoots WHERE campaign_id = '33dce958-87ef-440b-b795-6255449cc601');

-- ============================================================================
-- Section 3: Two new campaigns (Winter Wellness, Valentine's Sweet Treats)
-- ============================================================================

INSERT INTO campaigns (id, wf_number, name, brand, status, headline, cta, notes,
                       producer_id, art_director_id, brand_owner_id,
                       assets_delivery_date)
VALUES
  ('c0ffee01-4444-4aaa-bbbb-000000000004', 'WF260404', 'Winter Wellness', 'GreenWise',
   'Planning', 'Reset, refresh, recharge', 'Wellness starts at Publix',
   'Early-stage planning. No shoots scheduled yet — vendor sourcing in week 1.',
   '54378362-b696-416b-9c89-4fb6982dd142',  -- Jenna
   NULL,
   '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
   CURRENT_DATE + INTERVAL '180 days'),

  ('c0ffee02-5555-4aaa-bbbb-000000000005', 'WF260201', 'Valentine''s Sweet Treats', 'Publix Bakery',
   'Complete', 'A little sweet for someone special', 'Find Valentine''s at Publix',
   'Q1 historical. Assets delivered, all invoices paid.',
   '4e9eca0c-eb47-42f9-81f4-a1e005e96fad',  -- Laura
   'f1ef5a0b-ae3f-4b0e-8280-e8fb67ac5e29',  -- Sarah
   '19e8a840-2935-4c41-bd4d-4b8d1c51aff0',
   CURRENT_DATE - INTERVAL '60 days')
ON CONFLICT (id) DO NOTHING;

-- Valentine's needs a shoot + historical dates
INSERT INTO shoots (id, campaign_id, name, shoot_type, location, sort_order)
VALUES ('c0ffee02-5555-4bbb-cccc-000000000005', 'c0ffee02-5555-4aaa-bbbb-000000000005',
        'Bakery Hero Shoot', 'Photo', 'Studio A', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO shoot_dates (id, shoot_id, shoot_date, location)
VALUES
  ('c0ffee02-5555-4ccc-dddd-000000000001', 'c0ffee02-5555-4bbb-cccc-000000000005', CURRENT_DATE - 90, 'Studio A'),
  ('c0ffee02-5555-4ccc-dddd-000000000002', 'c0ffee02-5555-4bbb-cccc-000000000005', CURRENT_DATE - 89, 'Studio A')
ON CONFLICT (id) DO NOTHING;

-- Winter Wellness intentionally has NO shoots yet — it's early planning.

-- ============================================================================
-- Section 4: Real Publix product catalog
-- ============================================================================
-- Brand is folded into the description prefix since the products table has
-- no brand column. image_url left NULL — Publix product images are behind a
-- bot wall and would need a Playwright crawl to populate. The pcom_link
-- column carries the real publix.com URL.

INSERT INTO products (id, name, department, description, pcom_link, lifecycle_phase) VALUES
  -- Spring Refresh
  ('a1b2c3d4-aaaa-4001-0001-000000000001', 'GreenWise Organic Whole Strawberries', 'Produce',
   'GreenWise — Organic whole strawberries from Publix''s natural and organic line.',
   'https://www.publix.com/pd/greenwise-strawberries-organic-whole/RIO-PCI-158492', 'live'),
  ('a1b2c3d4-aaaa-4001-0001-000000000002', 'Tulip Bouquet', 'Other',
   'Publix — Fresh-cut tulip bouquet from the Publix floral department.',
   'https://www.publix.com/pd/tulip-bouquet/RIO-PCI-115965', 'live'),
  ('a1b2c3d4-aaaa-4001-0001-000000000003', 'Asparagus', 'Produce',
   'Publix — Fresh green asparagus spears, sold by the bunch.',
   'https://www.publix.com/pd/asparagus/RIO-PCI-107000', 'live'),
  ('a1b2c3d4-aaaa-4001-0001-000000000004', 'Fresh Attitude Spring Mix, Prewashed', 'Produce',
   'Fresh Attitude — Prewashed spring mix of tender baby greens, ready to serve.',
   'https://www.publix.com/pd/fresh-attitude-spring-mix-prewashed/RIO-PCI-107459', 'live'),

  -- Summer Grilling Hero / Collection (shared)
  ('a1b2c3d4-aaaa-4002-0002-000000000001', 'GreenWise 92% Lean Ground Beef Burgers', 'Meat-Seafood',
   'GreenWise — 92% lean pre-formed ground beef burgers, raised without antibiotics.',
   'https://www.publix.com/pd/greenwise-92-lean-ground-beef-burgers-usda-inspected-raised-without-antibiotics/RIO-PCI-106605', 'live'),
  ('a1b2c3d4-aaaa-4002-0002-000000000002', 'Bachan''s The Original Japanese Barbecue Sauce', 'Grocery',
   'Bachan''s — Small-batch Japanese-style barbecue sauce, great for grilling and glazing.',
   'https://www.publix.com/pd/bachans-japanese-the-original-barbecue-sauce/RIO-PCI-601657', 'live'),
  ('a1b2c3d4-aaaa-4002-0002-000000000003', 'Birds Eye Corn on the Cob, Extra Sweet Mini Ears', 'Grocery',
   'Birds Eye — Extra-sweet mini ears of corn on the cob, ready to heat and serve.',
   'https://www.publix.com/pd/birds-eye-corn-on-the-cob-extra-sweet-mini-ears/RIO-PCI-110263', 'live'),
  ('a1b2c3d4-aaaa-4002-0002-000000000004', 'Large Red Seedless Watermelon', 'Produce',
   'Publix — Large whole red seedless watermelon, the classic summer fruit.',
   'https://www.publix.com/pd/large-red-seedless-watermelon/RIO-PCI-108331', 'live'),

  -- Back-to-School
  ('a1b2c3d4-aaaa-4003-0003-000000000001', 'Apple Bran Muffins, 13.5 oz', 'Bakery',
   'Publix Bakery — Soft apple bran muffins, perfect for breakfast on the go.',
   'https://www.publix.com/pd/apple-bran-muffins-135oz/RIO-PCI-594106', 'live'),
  ('a1b2c3d4-aaaa-4003-0003-000000000002', 'Borden 2% Reduced Fat Milk', 'Grocery',
   'Borden — Classic 2% reduced fat milk for breakfast, lunchboxes, and recipes.',
   'https://www.publix.com/pd/borden-2-milk-sharp-cheddar-cheese-singles/RIO-PCI-266756', 'live'),
  ('a1b2c3d4-aaaa-4003-0003-000000000003', 'Capri Sun Fruit Punch Juice Drink Blend', 'Grocery',
   'Capri Sun — Kid-favorite fruit punch juice pouches for lunchboxes.',
   'https://www.publix.com/pd/capri-sun-fruit-punch-juice-drink-blend/RIO-PCI-140382', 'live'),
  ('a1b2c3d4-aaaa-4003-0003-000000000004', 'Frigo Cheese Heads String Cheese, Original 16-Pack', 'Grocery',
   'Frigo Cheese Heads — Low-moisture part-skim mozzarella string cheese, family-size 16-pack.',
   'https://www.publix.com/pd/frigo-cheeseheads-string-cheese-original-16-pack/RIO-PCI-610445', 'live'),

  -- Fall Harvest
  ('a1b2c3d4-aaaa-4004-0004-000000000001', '10 ct Pumpkin Shortbread Cookies', 'Bakery',
   'Publix Bakery — Buttery pumpkin-shaped shortbread cookies, a fall favorite.',
   'https://www.publix.com/pd/10ct-pumpkin-shortbread-cookie/RIO-PCI-111384', 'live'),
  ('a1b2c3d4-aaaa-4004-0004-000000000002', 'Mini Pumpkin Cupcakes, 12 ct', 'Bakery',
   'Publix Bakery — Twelve mini pumpkin-flavored cupcakes, perfect for fall gatherings.',
   'https://www.publix.com/pd/mini-pumpkin-cupcakes-12ct/RIO-PCI-573991', 'live'),
  ('a1b2c3d4-aaaa-4004-0004-000000000003', 'Musselman''s 100% Apple Cider, Fresh Pressed', 'Grocery',
   'Musselman''s — Fresh-pressed pasteurized 100% apple cider, a fall pantry essential.',
   'https://www.publix.com/pd/musselmans-100-apple-cider-fresh-pressed-pasteurized/RIO-PCI-625585', 'live'),
  ('a1b2c3d4-aaaa-4004-0004-000000000004', 'Butternut Squash', 'Produce',
   'Publix — Whole fresh butternut squash, sold individually.',
   'https://www.publix.com/pd/butternut-squash/RIO-PCI-107039', 'live'),

  -- Holiday Hosting
  ('a1b2c3d4-aaaa-4005-0005-000000000001', 'Butterball Cook From Frozen Premium Whole Turkey', 'Meat-Seafood',
   'Butterball — Premium whole turkey that can be cooked straight from frozen, holiday centerpiece.',
   'https://www.publix.com/pd/butterball-cook-from-frozen-premium-whole-turkey/RIO-PCI-239712', 'live'),
  ('a1b2c3d4-aaaa-4005-0005-000000000002', 'Boar''s Head Charcuterie and Cheese', 'Deli',
   'Boar''s Head — Curated charcuterie and cheese assortment, ready for entertaining.',
   'https://www.publix.com/pd/boars-head-charcuterie-and-cheese/RIO-PCI-614104', 'live'),
  ('a1b2c3d4-aaaa-4005-0005-000000000003', 'Martinelli''s Gold Medal Sparkling Cider', 'Grocery',
   'Martinelli''s — Classic non-alcoholic sparkling apple cider in the iconic apple-shaped bottle.',
   'https://www.publix.com/pd/martinellis-gold-medal-organic-sparkling-cider/RIO-PCI-194729', 'live'),
  ('a1b2c3d4-aaaa-4005-0005-000000000004', 'Publix Bakery Dinner Rolls, 12 ct', 'Bakery',
   'Publix Bakery — Soft baked dinner rolls, twelve to a pack.',
   'https://www.publix.com/pd/dinner-rolls-12ct/RIO-BBR-118987', 'live'),

  -- Winter Wellness
  ('a1b2c3d4-aaaa-4006-0006-000000000001', 'GreenWise Organic Whole Milk Plain Greek Yogurt', 'Grocery',
   'GreenWise — Organic whole milk plain Greek yogurt.',
   'https://www.publix.com/pd/greenwise-yogurt-greek-organic-whole-milk-plain/RIO-PCI-551247', 'live'),
  ('a1b2c3d4-aaaa-4006-0006-000000000002', 'Navel Oranges', 'Produce',
   'Publix — Sweet, juicy navel oranges, sold by the pound.',
   'https://www.publix.com/pd/navel-oranges/RIO-PCI-107590', 'live'),
  ('a1b2c3d4-aaaa-4006-0006-000000000003', 'GreenWise Cran Seed Nut Granola', 'Grocery',
   'GreenWise — Crunchy granola with cranberries, seeds, and nuts.',
   'https://www.publix.com/pd/greenwise-cran-seed-nut-granola/RIO-PCI-525498', 'live'),
  ('a1b2c3d4-aaaa-4006-0006-000000000004', '221 B.C. Kombucha, Berry & Hibiscus', 'Grocery',
   '221 B.C. — Raw kombucha brewed with berry and hibiscus for a tart, refreshing finish.',
   'https://www.publix.com/pd/221-bc-kombucha-berry--hibiscus/RIO-PCI-558146', 'live'),

  -- Valentine's Sweet Treats (historical)
  ('a1b2c3d4-aaaa-4007-0007-000000000001', 'I Heart Peanut Butter Cake', 'Bakery',
   'Publix Bakery — Heart-shaped peanut butter cake, ideal for Valentine''s Day.',
   'https://www.publix.com/pd/i-heart-peanut-butter-cake/RIO-DDC-282120', 'live'),
  ('a1b2c3d4-aaaa-4007-0007-000000000002', 'Mini Hearts and Roses Vanilla Buttercream Cake', 'Bakery',
   'Publix Bakery — Mini vanilla buttercream cake decorated with hearts and roses.',
   'https://www.publix.com/pd/mini-hearts-and-roses-vanilla-buttercream-cake/RIO-PCI-118802', 'live'),
  ('a1b2c3d4-aaaa-4007-0007-000000000003', 'Classic Dozen Roses', 'Other',
   'Publix — A classic dozen long-stem roses from the Publix floral department.',
   'https://www.publix.com/pd/classic-dozen-roses/RIO-PCI-115437', 'live')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  description = EXCLUDED.description,
  pcom_link = EXCLUDED.pcom_link;

-- ============================================================================
-- Section 5: Link products to campaigns (hero / secondary)
-- ============================================================================
-- Clear out any prior links for the campaigns we're restaging so the matrix
-- is deterministic, then re-insert.

DELETE FROM campaign_products WHERE campaign_id IN (
  '6e5bfb11-91f6-4472-a298-b98f925b6b6b',
  'a1b2c3d4-1111-4aaa-bbbb-000000000001',
  'a1b2c3d4-2222-4aaa-bbbb-000000000002',
  'a1b2c3d4-3333-4aaa-bbbb-000000000003',
  '7d683373-cb3e-40f2-bd84-c7786341694d',
  '82e4710f-9815-4ea2-b128-ee0b0459014b',
  '9dcb0fc3-860a-46f4-b220-9b58f7f21c7d',
  '7318c8f3-aba4-48df-89ac-819141aece0f',
  '8cd09a3b-4a5a-4b7a-ace9-523f15ea298a',
  '07c8ba2c-d282-4a5c-8bc8-e569a4cf5eef',
  '33dce958-87ef-440b-b795-6255449cc601',
  'c0ffee01-4444-4aaa-bbbb-000000000004',
  'c0ffee02-5555-4aaa-bbbb-000000000005'
);

INSERT INTO campaign_products (campaign_id, product_id, role, sort_order, notes) VALUES
  -- Spring Refresh
  ('6e5bfb11-91f6-4472-a298-b98f925b6b6b', 'a1b2c3d4-aaaa-4001-0001-000000000001', 'hero', 0, 'Hero of the spring concept deck'),
  ('6e5bfb11-91f6-4472-a298-b98f925b6b6b', 'a1b2c3d4-aaaa-4001-0001-000000000002', 'secondary', 1, ''),
  ('6e5bfb11-91f6-4472-a298-b98f925b6b6b', 'a1b2c3d4-aaaa-4001-0001-000000000003', 'secondary', 2, ''),
  ('6e5bfb11-91f6-4472-a298-b98f925b6b6b', 'a1b2c3d4-aaaa-4001-0001-000000000004', 'secondary', 3, ''),

  -- Summer Grilling Hero
  ('a1b2c3d4-1111-4aaa-bbbb-000000000001', 'a1b2c3d4-aaaa-4002-0002-000000000001', 'hero', 0, 'Hero burger shot'),
  ('a1b2c3d4-1111-4aaa-bbbb-000000000001', 'a1b2c3d4-aaaa-4002-0002-000000000002', 'secondary', 1, ''),
  ('a1b2c3d4-1111-4aaa-bbbb-000000000001', 'a1b2c3d4-aaaa-4002-0002-000000000003', 'secondary', 2, ''),
  ('a1b2c3d4-1111-4aaa-bbbb-000000000001', 'a1b2c3d4-aaaa-4002-0002-000000000004', 'secondary', 3, ''),

  -- Back-to-School
  ('a1b2c3d4-2222-4aaa-bbbb-000000000002', 'a1b2c3d4-aaaa-4003-0003-000000000001', 'hero', 0, 'Hero lunchbox spread'),
  ('a1b2c3d4-2222-4aaa-bbbb-000000000002', 'a1b2c3d4-aaaa-4003-0003-000000000002', 'secondary', 1, ''),
  ('a1b2c3d4-2222-4aaa-bbbb-000000000002', 'a1b2c3d4-aaaa-4003-0003-000000000003', 'secondary', 2, ''),
  ('a1b2c3d4-2222-4aaa-bbbb-000000000002', 'a1b2c3d4-aaaa-4003-0003-000000000004', 'secondary', 3, ''),

  -- Fall Harvest
  ('a1b2c3d4-3333-4aaa-bbbb-000000000003', 'a1b2c3d4-aaaa-4004-0004-000000000001', 'hero', 0, 'Hero — pumpkin shortbread on linen'),
  ('a1b2c3d4-3333-4aaa-bbbb-000000000003', 'a1b2c3d4-aaaa-4004-0004-000000000002', 'secondary', 1, ''),
  ('a1b2c3d4-3333-4aaa-bbbb-000000000003', 'a1b2c3d4-aaaa-4004-0004-000000000003', 'secondary', 2, ''),
  ('a1b2c3d4-3333-4aaa-bbbb-000000000003', 'a1b2c3d4-aaaa-4004-0004-000000000004', 'secondary', 3, ''),

  -- Holiday Hosting
  ('7d683373-cb3e-40f2-bd84-c7786341694d', 'a1b2c3d4-aaaa-4005-0005-000000000001', 'hero', 0, 'Hero — holiday turkey table'),
  ('7d683373-cb3e-40f2-bd84-c7786341694d', 'a1b2c3d4-aaaa-4005-0005-000000000002', 'secondary', 1, ''),
  ('7d683373-cb3e-40f2-bd84-c7786341694d', 'a1b2c3d4-aaaa-4005-0005-000000000003', 'secondary', 2, ''),
  ('7d683373-cb3e-40f2-bd84-c7786341694d', 'a1b2c3d4-aaaa-4005-0005-000000000004', 'secondary', 3, ''),

  -- Summer Grilling Collection (reuses grilling products)
  ('82e4710f-9815-4ea2-b128-ee0b0459014b', 'a1b2c3d4-aaaa-4002-0002-000000000004', 'hero', 0, 'Hero — watermelon centerpiece'),
  ('82e4710f-9815-4ea2-b128-ee0b0459014b', 'a1b2c3d4-aaaa-4002-0002-000000000003', 'secondary', 1, ''),
  ('82e4710f-9815-4ea2-b128-ee0b0459014b', 'a1b2c3d4-aaaa-4002-0002-000000000002', 'secondary', 2, ''),

  -- Plant-Based Meat Showcase (reuses charcuterie + grilling)
  ('9dcb0fc3-860a-46f4-b220-9b58f7f21c7d', 'a1b2c3d4-aaaa-4002-0002-000000000001', 'hero', 0, 'Hero — plant-forward burger build'),
  ('9dcb0fc3-860a-46f4-b220-9b58f7f21c7d', 'a1b2c3d4-aaaa-4005-0005-000000000002', 'secondary', 1, ''),

  -- Bakery Section Remodel (reuses bakery items)
  ('7318c8f3-aba4-48df-89ac-819141aece0f', 'a1b2c3d4-aaaa-4005-0005-000000000004', 'hero', 0, 'Hero — bakery case dinner rolls'),
  ('7318c8f3-aba4-48df-89ac-819141aece0f', 'a1b2c3d4-aaaa-4003-0003-000000000001', 'secondary', 1, ''),
  ('7318c8f3-aba4-48df-89ac-819141aece0f', 'a1b2c3d4-aaaa-4004-0004-000000000002', 'secondary', 2, ''),

  -- Organic Produce Campaign (reuses spring produce)
  ('8cd09a3b-4a5a-4b7a-ace9-523f15ea298a', 'a1b2c3d4-aaaa-4001-0001-000000000001', 'hero', 0, 'Hero — organic strawberries'),
  ('8cd09a3b-4a5a-4b7a-ace9-523f15ea298a', 'a1b2c3d4-aaaa-4001-0001-000000000003', 'secondary', 1, ''),
  ('8cd09a3b-4a5a-4b7a-ace9-523f15ea298a', 'a1b2c3d4-aaaa-4001-0001-000000000004', 'secondary', 2, ''),

  -- Spring Organic Pasta Launch (uses spring mix + cider as a pasta-night vignette)
  ('07c8ba2c-d282-4a5c-8bc8-e569a4cf5eef', 'a1b2c3d4-aaaa-4001-0001-000000000004', 'hero', 0, 'Hero — fresh pasta + spring greens'),
  ('07c8ba2c-d282-4a5c-8bc8-e569a4cf5eef', 'a1b2c3d4-aaaa-4001-0001-000000000003', 'secondary', 1, ''),

  -- Customer Testimonial Series (uses GreenWise items as the "story" products)
  ('33dce958-87ef-440b-b795-6255449cc601', 'a1b2c3d4-aaaa-4006-0006-000000000001', 'hero', 0, 'Hero — GreenWise customer story'),
  ('33dce958-87ef-440b-b795-6255449cc601', 'a1b2c3d4-aaaa-4006-0006-000000000003', 'secondary', 1, ''),

  -- Winter Wellness (NEW)
  ('c0ffee01-4444-4aaa-bbbb-000000000004', 'a1b2c3d4-aaaa-4006-0006-000000000001', 'hero', 0, 'Hero — Greek yogurt with citrus'),
  ('c0ffee01-4444-4aaa-bbbb-000000000004', 'a1b2c3d4-aaaa-4006-0006-000000000002', 'secondary', 1, ''),
  ('c0ffee01-4444-4aaa-bbbb-000000000004', 'a1b2c3d4-aaaa-4006-0006-000000000003', 'secondary', 2, ''),
  ('c0ffee01-4444-4aaa-bbbb-000000000004', 'a1b2c3d4-aaaa-4006-0006-000000000004', 'secondary', 3, ''),

  -- Valentine's Sweet Treats (NEW, historical)
  ('c0ffee02-5555-4aaa-bbbb-000000000005', 'a1b2c3d4-aaaa-4007-0007-000000000001', 'hero', 0, 'Hero — heart-shaped cake'),
  ('c0ffee02-5555-4aaa-bbbb-000000000005', 'a1b2c3d4-aaaa-4007-0007-000000000002', 'secondary', 1, ''),
  ('c0ffee02-5555-4aaa-bbbb-000000000005', 'a1b2c3d4-aaaa-4007-0007-000000000003', 'secondary', 2, '');

-- ============================================================================
-- Section 6: Snap any weekend shoot dates to weekdays (we don't shoot weekends)
-- ============================================================================
-- The CURRENT_DATE-relative offsets above will land on weekends depending on
-- what day of the week the migration is applied. Shift any affected shoot's
-- entire date block forward by 1 day, processed later-date-first to dodge the
-- (shoot_id, shoot_date) unique constraint. Two passes handle Saturdays that
-- become Sundays after the first shift.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM shoot_dates
    WHERE shoot_id IN (SELECT DISTINCT shoot_id FROM shoot_dates WHERE EXTRACT(DOW FROM shoot_date) IN (0,6))
    ORDER BY shoot_date DESC
  LOOP
    UPDATE shoot_dates SET shoot_date = shoot_date + 1 WHERE id = r.id;
  END LOOP;
  FOR r IN
    SELECT id FROM shoot_dates
    WHERE shoot_id IN (SELECT DISTINCT shoot_id FROM shoot_dates WHERE EXTRACT(DOW FROM shoot_date) IN (0,6))
    ORDER BY shoot_date DESC
  LOOP
    UPDATE shoot_dates SET shoot_date = shoot_date + 1 WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;
