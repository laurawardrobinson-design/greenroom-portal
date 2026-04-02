-- ============================================================
-- 028: Seed 3 new campaigns + contact preferences
-- ============================================================

-- --------------------------------------------------------
-- 1. CAMPAIGNS
-- --------------------------------------------------------
INSERT INTO public.campaigns (id, wf_number, name, brand, status, production_budget, budget_pool_id, assets_delivery_date, notes, created_by, created_at) VALUES
  ('a1b2c3d4-1111-4aaa-bbbb-000000000001', 'WF260401', 'Summer Grilling Hero Shoot', 'GreenWise', 'In Production', 28000, 'a83d2f1a-bd4d-4867-91f8-402cb8114539', '2026-05-02', 'Hero imagery for summer grilling endcap and digital. Focus on GreenWise organic meats.', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', now()),
  ('a1b2c3d4-2222-4aaa-bbbb-000000000002', 'WF260402', 'Back-to-School Lunchbox Series', 'Publix', 'Upcoming', 35000, 'a83d2f1a-bd4d-4867-91f8-402cb8114539', '2026-06-20', 'Multi-channel lunchbox content for back-to-school push. Mix of photo and short-form video.', '54378362-b696-416b-9c89-4fb6982dd142', now()),
  ('a1b2c3d4-3333-4aaa-bbbb-000000000003', 'WF260403', 'Fall Harvest Baking Campaign', 'Publix', 'Planning', 20000, 'a83d2f1a-bd4d-4867-91f8-402cb8114539', '2026-09-30', 'Seasonal baking campaign for fall. Warm tones, pumpkin spice, cozy kitchen feel.', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', now());

-- --------------------------------------------------------
-- 2. SHOOTS (one shoot per campaign)
-- --------------------------------------------------------
INSERT INTO public.shoots (id, campaign_id, name, shoot_type, location, notes, sort_order) VALUES
  ('b1000001-0001-4bbb-aaaa-000000000001', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', 'Grill Station Hero Day', 'Photo', 'Studio A — Outdoor Patio Set', 'Full day shoot, outdoor grill setup', 1),
  ('b1000001-0002-4bbb-aaaa-000000000002', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', 'Lunchbox Content Day', 'Hybrid', 'Studio B — Kitchen Set', 'Photo + short video clips for social', 1),
  ('b1000001-0003-4bbb-aaaa-000000000003', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', 'Baking Station Shoot', 'Photo', 'Studio A — Kitchen Set', 'Warm, cozy fall lighting setup', 1);

-- --------------------------------------------------------
-- 3. SHOOT DATES
-- --------------------------------------------------------
INSERT INTO public.shoot_dates (id, shoot_id, shoot_date, call_time, location, notes) VALUES
  ('c1000001-0001-4ccc-aaaa-000000000001', 'b1000001-0001-4bbb-aaaa-000000000001', '2026-04-15', '07:00', 'Studio A — Outdoor Patio Set', 'Grill preheat by 8 AM'),
  ('c1000001-0002-4ccc-aaaa-000000000002', 'b1000001-0001-4bbb-aaaa-000000000001', '2026-04-16', '07:30', 'Studio A — Outdoor Patio Set', 'Lifestyle and sides shots'),
  ('c1000001-0003-4ccc-aaaa-000000000003', 'b1000001-0002-4bbb-aaaa-000000000002', '2026-05-06', '08:00', 'Studio B — Kitchen Set', 'Photo day — all lunchbox builds'),
  ('c1000001-0004-4ccc-aaaa-000000000004', 'b1000001-0002-4bbb-aaaa-000000000002', '2026-05-07', '08:00', 'Studio B — Kitchen Set', 'Video day — action pours and lifestyle'),
  ('c1000001-0005-4ccc-aaaa-000000000005', 'b1000001-0003-4bbb-aaaa-000000000003', '2026-09-09', '08:00', 'Studio A — Kitchen Set', 'Full baking shoot day');

-- --------------------------------------------------------
-- 4. SHOT LIST SETUPS
-- --------------------------------------------------------
INSERT INTO public.shot_list_setups (id, campaign_id, name, description, location, media_type, sort_order) VALUES
  ('d1000001-0001-4ddd-aaaa-000000000001', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', 'Grill Station Hero', 'Hero platter and detail shots of grilled meats and sides', 'Studio A — Outdoor Patio Set', 'Photo', 1),
  ('d1000001-0002-4ddd-aaaa-000000000002', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', 'Lunchbox Builds', 'Overhead and lifestyle shots of assembled lunchboxes', 'Studio B — Kitchen Set', 'Hybrid', 1),
  ('d1000001-0003-4ddd-aaaa-000000000003', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', 'Baking Station', 'Hero baked goods and process action shots', 'Studio A — Kitchen Set', 'Photo', 1);

-- --------------------------------------------------------
-- 5. SHOT LIST SHOTS (4 per campaign)
-- --------------------------------------------------------

-- Summer Grilling
INSERT INTO public.shot_list_shots (id, setup_id, campaign_id, name, description, angle, media_type, status, props, talent, wardrobe, sort_order) VALUES
  ('e1000001-0001-4eee-aaaa-000000000001', 'd1000001-0001-4ddd-aaaa-000000000001', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', 'Grilled Ribeye Platter Overhead', 'Overhead flat-lay of grilled ribeye with herbs, compound butter, and char marks visible', 'Overhead / Bird''s Eye', 'Photo', 'Pending', 'Cast iron platter, fresh rosemary, compound butter, linen napkin', '', '', 1),
  ('e1000001-0002-4eee-aaaa-000000000002', 'd1000001-0001-4ddd-aaaa-000000000001', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', 'Sear Marks Close-Up', 'Tight close-up of sear marks on steak with steam rising', '45-Degree Detail', 'Photo', 'Pending', 'Grill grates, tongs, steam effect', '', '', 2),
  ('e1000001-0003-4eee-aaaa-000000000003', 'd1000001-0001-4ddd-aaaa-000000000001', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', 'Family Serving Lifestyle', 'Lifestyle shot of family serving grilled food at patio table, natural light', 'Eye Level / Wide', 'Photo', 'Pending', 'Outdoor patio table, serving utensils, beverage glasses', 'Family of 4 (2 adults, 2 kids)', 'Casual summer — linen and cotton', 3),
  ('e1000001-0004-4eee-aaaa-000000000004', 'd1000001-0001-4ddd-aaaa-000000000001', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', 'Grilled Corn & Sides Wide', 'Wide shot of grilled corn, coleslaw, and baked beans spread on rustic table', 'Overhead / 45-Degree', 'Photo', 'Pending', 'Wooden serving boards, corn holders, ceramic bowls, rustic table', '', '', 4);

-- Back-to-School Lunchbox
INSERT INTO public.shot_list_shots (id, setup_id, campaign_id, name, description, angle, media_type, status, props, talent, wardrobe, sort_order) VALUES
  ('e1000001-0005-4eee-aaaa-000000000005', 'd1000001-0002-4ddd-aaaa-000000000002', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', 'Turkey Wrap Bento Overhead', 'Overhead of assembled bento box with turkey wrap, veggies, and dip', 'Overhead / Bird''s Eye', 'Photo', 'Pending', 'Bento box, parchment paper, silicone cups, kid-friendly utensils', '', '', 1),
  ('e1000001-0006-4eee-aaaa-000000000006', 'd1000001-0002-4ddd-aaaa-000000000002', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', 'Fruit Cup Action Pour', 'Action shot of blueberries being poured into fruit cup, slight motion blur', '45-Degree Action', 'Video', 'Pending', 'Clear fruit cup, assorted berries, cutting board', '', '', 2),
  ('e1000001-0007-4eee-aaaa-000000000007', 'd1000001-0002-4ddd-aaaa-000000000002', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', 'Kid Reaching for Lunchbox', 'Lifestyle of kid grabbing lunchbox off kitchen counter, morning light', 'Eye Level / Medium', 'Photo', 'Pending', 'Colorful lunchbox, backpack, kitchen counter styling', 'Child talent (age 7-10)', 'School outfit — polo shirt, shorts', 3),
  ('e1000001-0008-4eee-aaaa-000000000008', 'd1000001-0002-4ddd-aaaa-000000000002', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', 'Full Spread Ingredient Flat-Lay', 'All lunchbox ingredients arranged in flat-lay grid pattern on marble surface', 'Overhead / Bird''s Eye', 'Photo', 'Pending', 'Marble surface, ingredient portions in small bowls, labels', '', '', 4);

-- Fall Harvest Baking
INSERT INTO public.shot_list_shots (id, setup_id, campaign_id, name, description, angle, media_type, status, props, talent, wardrobe, sort_order) VALUES
  ('e1000001-0009-4eee-aaaa-000000000009', 'd1000001-0003-4ddd-aaaa-000000000003', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', 'Pumpkin Pie Hero', 'Whole pumpkin pie on cooling rack with one slice pulled, warm side light', '45-Degree Hero', 'Photo', 'Pending', 'Wire cooling rack, pie server, autumn leaves, linen runner', '', '', 1),
  ('e1000001-0010-4eee-aaaa-000000000010', 'd1000001-0003-4ddd-aaaa-000000000003', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', 'Flour Dust Action', 'Action shot of flour being sifted mid-air over dough, frozen motion', 'Eye Level / Detail', 'Photo', 'Pending', 'Sifter, wooden rolling pin, dusted countertop, apron', 'Hand model', '', 2),
  ('e1000001-0011-4eee-aaaa-000000000011', 'd1000001-0003-4ddd-aaaa-000000000003', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', 'Cinnamon Roll Tray', 'Fresh-from-oven cinnamon rolls on baking tray, warm golden glow, steam', '45-Degree / Warm', 'Photo', 'Pending', 'Baking tray, parchment paper, icing bowl, cinnamon sticks', '', '', 3),
  ('e1000001-0012-4eee-aaaa-000000000012', 'd1000001-0003-4ddd-aaaa-000000000003', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', 'Ingredients Lineup', 'All baking ingredients in a clean lineup on marble counter — flour, sugar, pumpkin, spices, butter, eggs', 'Overhead / Grid', 'Photo', 'Pending', 'Marble counter, glass bowls, measuring cups, whole spices', '', '', 4);

-- --------------------------------------------------------
-- 6. VENDOR ASSIGNMENTS (campaign_vendors)
-- --------------------------------------------------------

-- Summer Grilling → Sarah Chen (Photographer), Culinary Artistry (Food Stylist), Set Dressing Pro (Prop Stylist)
INSERT INTO public.campaign_vendors (id, campaign_id, vendor_id, status, invited_at, notes) VALUES
  ('f1000001-0001-4fff-aaaa-000000000001', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', '5f6ce27e-a511-4e57-894a-d03903e4eedc', 'Invited', now(), 'Lead photographer for grilling hero shoot'),
  ('f1000001-0002-4fff-aaaa-000000000002', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', '10eaa759-2c52-4cdc-b785-9fee19260df2', 'Invited', now(), 'Food styling for grilled meats and sides'),
  ('f1000001-0003-4fff-aaaa-000000000003', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', 'c91b4132-4632-411e-b0a7-c92882ab8b79', 'Invited', now(), 'Prop styling — outdoor patio and rustic table setup');

-- Back-to-School → Lightbox Studios (Studio), Sarah Chen (Photographer), Post Production Masters (Retoucher)
INSERT INTO public.campaign_vendors (id, campaign_id, vendor_id, status, invited_at, notes) VALUES
  ('f1000001-0004-4fff-aaaa-000000000004', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', 'f7953454-2088-452b-aef2-8026b3fd3daf', 'Invited', now(), 'Studio rental for lunchbox shoot days'),
  ('f1000001-0005-4fff-aaaa-000000000005', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', '5f6ce27e-a511-4e57-894a-d03903e4eedc', 'Invited', now(), 'Photo and video capture'),
  ('f1000001-0006-4fff-aaaa-000000000006', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', '2365cda1-6851-4d7c-a95b-1372ad06b5cb', 'Invited', now(), 'Retouching and color grading for lunchbox assets');

-- Fall Harvest Baking → Sarah Chen (Photographer), Culinary Artistry (Food Stylist)
INSERT INTO public.campaign_vendors (id, campaign_id, vendor_id, status, invited_at, notes) VALUES
  ('f1000001-0007-4fff-aaaa-000000000007', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', '5f6ce27e-a511-4e57-894a-d03903e4eedc', 'Invited', now(), 'Lead photographer for baking shoot'),
  ('f1000001-0008-4fff-aaaa-000000000008', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', '10eaa759-2c52-4cdc-b785-9fee19260df2', 'Invited', now(), 'Food styling for pies, rolls, and ingredient shots');

-- --------------------------------------------------------
-- 7. GEAR RESERVATIONS
-- --------------------------------------------------------

-- Summer Grilling (Apr 14-18): Canon EOS R5, Aputure 600d, Overhead Shooting Rig
INSERT INTO public.gear_reservations (id, gear_item_id, user_id, campaign_id, start_date, end_date, status, notes) VALUES
  ('aa000001-0001-4aaa-bbbb-000000000001', 'bcbbd473-1e3a-43b8-8575-c70866f2e321', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', '2026-04-14', '2026-04-18', 'Confirmed', 'Canon R5 for grilling hero shoot'),
  ('aa000001-0002-4aaa-bbbb-000000000002', '558aa58a-bcb6-4c74-a130-36aa941d267d', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', '2026-04-14', '2026-04-18', 'Confirmed', 'Aputure 600d for grill lighting'),
  ('aa000001-0003-4aaa-bbbb-000000000003', 'e4ab4bbd-d95f-4b07-a03c-d81203041db7', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', 'a1b2c3d4-1111-4aaa-bbbb-000000000001', '2026-04-14', '2026-04-18', 'Confirmed', 'Overhead rig for flat-lay shots');

-- Back-to-School (May 5-9): Sony FX3, Standard Zoom Lens, Bi-Color LED Panel
INSERT INTO public.gear_reservations (id, gear_item_id, user_id, campaign_id, start_date, end_date, status, notes) VALUES
  ('aa000001-0004-4aaa-bbbb-000000000004', '618fcdc9-8765-4bfe-898b-fbde89ec019d', '54378362-b696-416b-9c89-4fb6982dd142', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', '2026-05-05', '2026-05-09', 'Confirmed', 'Sony FX3 for video + photo hybrid'),
  ('aa000001-0005-4aaa-bbbb-000000000005', 'a245542d-772f-486d-8352-dc27d2c978b8', '54378362-b696-416b-9c89-4fb6982dd142', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', '2026-05-05', '2026-05-09', 'Confirmed', 'Standard zoom for lunchbox shoot'),
  ('aa000001-0006-4aaa-bbbb-000000000006', 'a186acee-80ab-40cd-ac47-cba561dc6255', '54378362-b696-416b-9c89-4fb6982dd142', 'a1b2c3d4-2222-4aaa-bbbb-000000000002', '2026-05-05', '2026-05-09', 'Confirmed', 'LED panel for kitchen set fill');

-- Fall Harvest Baking (Sep 8-12): Canon EOS R5, Portrait Prime Lens, Fluid Head Tripod
INSERT INTO public.gear_reservations (id, gear_item_id, user_id, campaign_id, start_date, end_date, status, notes) VALUES
  ('aa000001-0007-4aaa-bbbb-000000000007', 'bcbbd473-1e3a-43b8-8575-c70866f2e321', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', '2026-09-08', '2026-09-12', 'Confirmed', 'Canon R5 for baking hero shots'),
  ('aa000001-0008-4aaa-bbbb-000000000008', 'b338145c-94c9-4296-9a99-389744b53dd2', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', '2026-09-08', '2026-09-12', 'Confirmed', '85mm portrait lens for detail shots'),
  ('aa000001-0009-4aaa-bbbb-000000000009', '7558688d-b614-4b8a-b9f0-11d2230b13c8', '4e9eca0c-eb47-42f9-81f4-a1e005e96fad', 'a1b2c3d4-3333-4aaa-bbbb-000000000003', '2026-09-08', '2026-09-12', 'Confirmed', 'Tripod for stable baking process shots');

-- --------------------------------------------------------
-- 8. CONTACT PREFERENCES (update all 9 users)
-- --------------------------------------------------------

-- Gretchen Siss (Admin) — keep existing values, fill gaps
UPDATE public.users SET
  lunch_place = 'Chicken Salad Chick',
  onboarding_completed = true
WHERE id = '53555e77-1cbb-431b-b7e7-f835dac7634b';

-- Laura Robinson (Producer) — keep Pub Sub, fill preferences
UPDATE public.users SET
  favorite_drinks = 'Sweet tea, Sparkling water',
  favorite_snacks = 'Cheese crackers',
  energy_boost = 'Vanilla oat milk latte',
  lunch_place = 'Bento Asian Kitchen',
  onboarding_completed = true
WHERE id = '4e9eca0c-eb47-42f9-81f4-a1e005e96fad';

-- Jenna Cartwright (Producer)
UPDATE public.users SET
  favorite_drinks = 'Diet Dr Pepper',
  favorite_snacks = 'Dark chocolate almonds',
  energy_boost = 'Caramel macchiato',
  dietary_restrictions = 'Vegetarian',
  favorite_publix_product = 'Chantilly Cake',
  lunch_place = 'Panera',
  onboarding_completed = true
WHERE id = '54378362-b696-416b-9c89-4fb6982dd142';

-- Miles Nakamura (Producer)
UPDATE public.users SET
  favorite_drinks = 'Cold brew, Matcha',
  favorite_snacks = 'Beef jerky',
  energy_boost = 'Black cold brew, no sugar',
  allergies = 'Shellfish',
  favorite_publix_product = 'Sushi',
  lunch_place = 'Tijuana Flats',
  onboarding_completed = true
WHERE id = '51a2fa4c-3206-45bf-9fe4-2239282ff116';

-- Ava Morales (Studio)
UPDATE public.users SET
  favorite_drinks = 'Topo Chico',
  favorite_snacks = 'Veggie straws, Hummus',
  energy_boost = 'Cortado with oat milk',
  dietary_restrictions = 'Vegan',
  allergies = 'Tree nuts',
  favorite_publix_product = 'Fresh Flowers',
  lunch_place = 'Cava',
  onboarding_completed = true
WHERE id = '5a39d881-a040-42ab-bddd-9682864b0ea4';

-- Derek Patel (Studio)
UPDATE public.users SET
  favorite_drinks = 'Ginger ale',
  favorite_snacks = 'Trail mix',
  energy_boost = 'Chai latte',
  favorite_publix_product = 'Deli Potato Wedges',
  lunch_place = 'Wawa',
  onboarding_completed = true
WHERE id = 'faa68bf9-6378-4401-88d3-391fb6854e64';

-- Studio Manager (Studio)
UPDATE public.users SET
  favorite_drinks = 'Water, Green tea',
  favorite_snacks = 'Pretzels',
  energy_boost = 'Americano',
  allergies = 'Dairy',
  favorite_publix_product = 'Fried Chicken',
  lunch_place = 'Firehouse Subs',
  onboarding_completed = true
WHERE id = '30ae1e49-ba51-4b73-b301-f75be9fbbfde';

-- Marcus Thompson (Vendor)
UPDATE public.users SET
  favorite_drinks = 'Pellegrino',
  favorite_snacks = 'Mixed nuts',
  energy_boost = 'Flat white',
  favorite_publix_product = 'Key Lime Pie',
  lunch_place = 'Capital Grille',
  onboarding_completed = true
WHERE id = '32e11953-f1cb-49e8-8275-2cd5942175bb';

-- Sarah Lindgren (Art Director)
UPDATE public.users SET
  favorite_drinks = 'Oat milk, Kombucha',
  favorite_snacks = 'Dried mango',
  energy_boost = 'Lavender latte',
  dietary_restrictions = 'Gluten-free',
  allergies = 'Wheat, Gluten',
  favorite_publix_product = 'Grab & Go Salad',
  lunch_place = 'Sweetgreen',
  onboarding_completed = true
WHERE id = 'f1ef5a0b-ae3f-4b0e-8280-e8fb67ac5e29';
