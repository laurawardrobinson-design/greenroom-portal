-- ============================================================
-- Migration 025: Demo Mode Seed Data
-- 5 vendors, 5 campaigns, estimates, POs, invoices
-- ============================================================

-- Insert Demo Vendors
INSERT INTO public.vendors (id, company_name, contact_name, email, phone, category, specialty, tax_id, active, onboarded_date, notes)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'Lightbox Studios Inc.',
    'Marcus Thompson',
    'marcus@lightboxstudios.demo',
    '(212) 555-0101',
    'Studio',
    'Full-service studio rental, equipment, and crew',
    '98-7654321',
    true,
    '2025-11-01',
    'Premium studio in Midtown. Excellent for food/product work. Has in-house lighting and grip.'
  ),
  (
    'a0000000-0000-0000-0000-000000000002'::uuid,
    'Sarah Chen Photography',
    'Sarah Chen',
    'sarah@chenphoto.demo',
    '(212) 555-0102',
    'Photographer',
    'Commercial food and product photography',
    '98-7654322',
    true,
    '2025-12-15',
    'Specializes in grocery/CPG work. 15+ years experience. Fast turnaround on retouching.'
  ),
  (
    'a0000000-0000-0000-0000-000000000003'::uuid,
    'Culinary Artistry Co.',
    'Elizabeth Ross',
    'elizabeth@culinaryartistry.demo',
    '(212) 555-0103',
    'Food Stylist',
    'Food styling and preparation for commercial shoots',
    '98-7654323',
    true,
    '2025-10-20',
    'Award-winning food stylist. Handles everything from prep to final styling on set.'
  ),
  (
    'a0000000-0000-0000-0000-000000000004'::uuid,
    'Set Dressing Pro LLC',
    'James Kim',
    'james@setdressingpro.demo',
    '(212) 555-0104',
    'Prop Stylist',
    'Set design, prop sourcing and styling',
    '98-7654324',
    true,
    '2025-09-10',
    'Prop sourcing network across tri-state area. Excellent for shelf-set and lifestyle shoots.'
  ),
  (
    'a0000000-0000-0000-0000-000000000005'::uuid,
    'Post Production Masters',
    'David Wu',
    'david@postmasters.demo',
    '(212) 555-0105',
    'Retoucher',
    'Image retouching and color grading',
    '98-7654325',
    true,
    '2025-11-25',
    'Fast turnaround retouching. Specializes in food color accuracy and product beauty work.'
  );

-- Insert Demo Campaigns
-- Using deterministic UUIDs for campaigns for reproducibility
INSERT INTO public.campaigns (id, wf_number, name, brand, status, production_budget, notes, created_by, created_at)
VALUES
  (
    'c0000000-0000-0000-0000-000000000001'::uuid,
    'WF210501',
    'Organic Produce Campaign',
    'Publix',
    'In Production',
    25000.00,
    'Spring 2026 organic section initiative. Multi-channel assets for print, digital, social.',
    'a0000000-0000-0000-0000-000000000099'::uuid,  -- producer user
    now()
  ),
  (
    'c0000000-0000-0000-0000-000000000002'::uuid,
    'WF210601',
    'Holiday Promotion 2026',
    'Publix',
    'Planning',
    45000.00,
    'Q4 major push. Three separate shoots for holiday bundles, gift sets, and party platters.',
    'a0000000-0000-0000-0000-000000000099'::uuid,
    now()
  ),
  (
    'c0000000-0000-0000-0000-000000000003'::uuid,
    'WF210701',
    'Plant-Based Meat Showcase',
    'Publix',
    'In Production',
    18000.00,
    'Lifestyle and detail shots for new plant-based meat section.',
    'a0000000-0000-0000-0000-000000000099'::uuid,
    now()
  ),
  (
    'c0000000-0000-0000-0000-000000000004'::uuid,
    'WF210801',
    'Bakery Section Remodel',
    'Publix',
    'Post',
    32000.00,
    'New bakery layout and fresh assortment hero shots.',
    'a0000000-0000-0000-0000-000000000099'::uuid,
    now()
  ),
  (
    'c0000000-0000-0000-0000-000000000005'::uuid,
    'WF210901',
    'Customer Testimonial Series',
    'Publix',
    'Planning',
    22000.00,
    'Six customer testimonial videos. Interviews and b-roll of shopping experience.',
    'a0000000-0000-0000-0000-000000000099'::uuid,
    now()
  );

-- Insert Campaign-Vendor Assignments with Estimates
-- Campaign 1: Organic Produce (Studio, Photographer, Food Stylist, Retoucher)
INSERT INTO public.campaign_vendors (id, campaign_id, vendor_id, status, estimate_total, notes)
VALUES
  -- Studio: Estimate Approved
  ('cv000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Estimate Approved', 8500.00, 'Studio rental 2 days, equipment included'),
  -- Photographer: PO Signed
  ('cv000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'PO Signed', 6200.00, 'Lead photographer + assistant, 2-day shoot'),
  -- Food Stylist: Estimate Submitted
  ('cv000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000003'::uuid, 'Estimate Submitted', 4500.00, 'Food styling for all setup and beauty shots'),
  -- Retoucher: Invoice Approved
  ('cv000000-0000-0000-0000-000000000004'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000005'::uuid, 'Invoice Approved', 3200.00, 'Retouching: 120 images @ $25/image + color grade'),

-- Campaign 2: Holiday Promotion 2026 (Studio, Photographer, Food Stylist, Props)
  ('cv000000-0000-0000-0000-000000000005'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Invited', 0.00, ''),
  ('cv000000-0000-0000-0000-000000000006'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Estimate Submitted', 14500.00, 'Lead photographer, 3-day shoot across 3 locations'),
  ('cv000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000003'::uuid, 'PO Signed', 9800.00, 'Food styling for holiday bundles, gift sets, party platters'),
  ('cv000000-0000-0000-0000-000000000008'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000004'::uuid, 'Invoice Submitted', 8200.00, 'Props and set dressing for all three shoot days'),

-- Campaign 3: Plant-Based Meat Showcase (Photographer, Food Stylist, Retoucher, Props)
  ('cv000000-0000-0000-0000-000000000009'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Invoice Approved', 5200.00, 'Photographer + assistant, 1-day shoot'),
  ('cv000000-0000-0000-0000-000000000010'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000003'::uuid, 'Estimate Approved', 3800.00, 'Food styling for lifestyle and detail shots'),
  ('cv000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000004'::uuid, 'PO Signed', 2900.00, 'Prop styling and lifestyle set dressing'),
  ('cv000000-0000-0000-0000-000000000012'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000005'::uuid, 'Invoice Submitted', 1800.00, 'Retouching for 72 images'),

-- Campaign 4: Bakery Section Remodel (Studio, Photographer, Props, Retoucher)
  ('cv000000-0000-0000-0000-000000000013'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Paid', 9200.00, 'Studio rental 1 day'),
  ('cv000000-0000-0000-0000-000000000014'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Paid', 7500.00, 'Lead photographer, 1-day shoot'),
  ('cv000000-0000-0000-0000-000000000015'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000004'::uuid, 'Invoice Approved', 5400.00, 'Props and bakery-themed set dressing'),
  ('cv000000-0000-0000-0000-000000000016'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'a0000000-0000-0000-0000-000000000005'::uuid, 'Paid', 2900.00, 'Retouching 116 images'),

-- Campaign 5: Customer Testimonial Series (Photographer only so far)
  ('cv000000-0000-0000-0000-000000000017'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'Estimate Submitted', 18500.00, 'Video production: 6 testimonials, interviews, b-roll, 5 days');

-- Insert Estimate Items for various assignments
-- Campaign 1, Studio
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000001'::uuid, 'Studio Space', 'Studio rental - 2 full days', 2, 2500.00, 5000.00, 1),
  ('cv000000-0000-0000-0000-000000000001'::uuid, 'Equipment Rental', 'Lighting kit and grip package', 1, 2000.00, 2000.00, 2),
  ('cv000000-0000-0000-0000-000000000001'::uuid, 'Styling', 'Gaffer and grip crew (2 people)', 2, 750.00, 1500.00, 3);

-- Campaign 1, Photographer
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000002'::uuid, 'Talent', 'Lead photographer - 2 days', 2, 2000.00, 4000.00, 1),
  ('cv000000-0000-0000-0000-000000000002'::uuid, 'Talent', 'Assistant photographer', 2, 600.00, 1200.00, 2),
  ('cv000000-0000-0000-0000-000000000002'::uuid, 'Travel', 'Travel and meals', 1, 1000.00, 1000.00, 3);

-- Campaign 1, Food Stylist
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000003'::uuid, 'Styling', 'Food styling - 2 days', 2, 1500.00, 3000.00, 1),
  ('cv000000-0000-0000-0000-000000000003'::uuid, 'Catering', 'Food and beverage materials', 1, 1200.00, 1200.00, 2),
  ('cv000000-0000-0000-0000-000000000003'::uuid, 'Travel', 'Travel and meals for stylist', 1, 300.00, 300.00, 3);

-- Campaign 1, Retoucher
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000004'::uuid, 'Post-Production', 'Image retouching - 120 images @ $25', 120, 25.00, 3000.00, 1),
  ('cv000000-0000-0000-0000-000000000004'::uuid, 'Post-Production', 'Color grading - full batch', 1, 200.00, 200.00, 2);

-- Campaign 2, Photographer
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000006'::uuid, 'Talent', 'Lead photographer - 3 days', 3, 3500.00, 10500.00, 1),
  ('cv000000-0000-0000-0000-000000000006'::uuid, 'Talent', 'Assistant photographer', 3, 700.00, 2100.00, 2),
  ('cv000000-0000-0000-0000-000000000006'::uuid, 'Travel', 'Travel and expenses', 1, 1900.00, 1900.00, 3);

-- Campaign 2, Food Stylist
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000007'::uuid, 'Styling', 'Food styling - 3 days (bundles, gift sets, platters)', 3, 2000.00, 6000.00, 1),
  ('cv000000-0000-0000-0000-000000000007'::uuid, 'Catering', 'Food materials and prop foods', 1, 2800.00, 2800.00, 2),
  ('cv000000-0000-0000-0000-000000000007'::uuid, 'Travel', 'Travel and meals', 1, 1000.00, 1000.00, 3);

-- Campaign 2, Props Stylist
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000008'::uuid, 'Props', 'Prop sourcing and rentals', 1, 5000.00, 5000.00, 1),
  ('cv000000-0000-0000-0000-000000000008'::uuid, 'Props', 'Set dressing labor - 3 days', 3, 1000.00, 3000.00, 2),
  ('cv000000-0000-0000-0000-000000000008'::uuid, 'Travel', 'Travel and delivery', 1, 200.00, 200.00, 3);

-- Campaign 3, Photographer
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000009'::uuid, 'Talent', 'Lead photographer - 1 day', 1, 3000.00, 3000.00, 1),
  ('cv000000-0000-0000-0000-000000000009'::uuid, 'Talent', 'Assistant', 1, 600.00, 600.00, 2),
  ('cv000000-0000-0000-0000-000000000009'::uuid, 'Travel', 'Travel and meals', 1, 1600.00, 1600.00, 3);

-- Campaign 3, Food Stylist
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000010'::uuid, 'Styling', 'Food styling - 1 day', 1, 2000.00, 2000.00, 1),
  ('cv000000-0000-0000-0000-000000000010'::uuid, 'Catering', 'Food materials', 1, 1300.00, 1300.00, 2),
  ('cv000000-0000-0000-0000-000000000010'::uuid, 'Travel', 'Travel and meals', 1, 500.00, 500.00, 3);

-- Campaign 3, Props Stylist
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000011'::uuid, 'Props', 'Lifestyle prop sourcing', 1, 1500.00, 1500.00, 1),
  ('cv000000-0000-0000-0000-000000000011'::uuid, 'Props', 'Set dressing labor - 1 day', 1, 900.00, 900.00, 2),
  ('cv000000-0000-0000-0000-000000000011'::uuid, 'Travel', 'Delivery and setup', 1, 500.00, 500.00, 3);

-- Campaign 3, Retoucher
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000012'::uuid, 'Post-Production', 'Retouching 72 images @ $25', 72, 25.00, 1800.00, 1);

-- Campaign 4, Studio
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000013'::uuid, 'Studio Space', 'Studio rental - 1 day', 1, 3500.00, 3500.00, 1),
  ('cv000000-0000-0000-0000-000000000013'::uuid, 'Equipment Rental', 'Full lighting and grip package', 1, 3200.00, 3200.00, 2),
  ('cv000000-0000-0000-0000-000000000013'::uuid, 'Equipment Rental', 'Gaffer and grip crew', 1, 2500.00, 2500.00, 3);

-- Campaign 4, Photographer
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000014'::uuid, 'Talent', 'Lead photographer - 1 day', 1, 3500.00, 3500.00, 1),
  ('cv000000-0000-0000-0000-000000000014'::uuid, 'Talent', 'Assistant', 1, 800.00, 800.00, 2),
  ('cv000000-0000-0000-0000-000000000014'::uuid, 'Equipment Rental', 'Camera rental (specialty)', 1, 1200.00, 1200.00, 3),
  ('cv000000-0000-0000-0000-000000000014'::uuid, 'Travel', 'Travel', 1, 2000.00, 2000.00, 4);

-- Campaign 4, Props Stylist
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000015'::uuid, 'Props', 'Bakery props and displays', 1, 3000.00, 3000.00, 1),
  ('cv000000-0000-0000-0000-000000000015'::uuid, 'Props', 'Set dressing labor', 1, 1500.00, 1500.00, 2),
  ('cv000000-0000-0000-0000-000000000015'::uuid, 'Travel', 'Delivery and setup', 1, 900.00, 900.00, 3);

-- Campaign 4, Retoucher
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000016'::uuid, 'Post-Production', 'Retouching 116 images @ $25', 116, 25.00, 2900.00, 1);

-- Campaign 5, Photographer
INSERT INTO public.vendor_estimate_items (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
VALUES
  ('cv000000-0000-0000-0000-000000000017'::uuid, 'Talent', 'Video producer/director - 5 days', 5, 2500.00, 12500.00, 1),
  ('cv000000-0000-0000-0000-000000000017'::uuid, 'Talent', 'Camera operator and sound', 5, 800.00, 4000.00, 2),
  ('cv000000-0000-0000-0000-000000000017'::uuid, 'Travel', 'Travel and meals', 1, 2000.00, 2000.00, 3);

-- Insert Invoices for completed work
-- Campaign 1, Retoucher - Invoice Approved
INSERT INTO public.vendor_invoices (id, campaign_vendor_id, file_url, file_name, submitted_at, parsed_data, parse_status, parsed_at, hop_approved_at)
VALUES
  (
    'inv00000-0000-0000-0000-000000000001'::uuid,
    'cv000000-0000-0000-0000-000000000004'::uuid,
    'files/demo-mode/invoices/inv-001-retoucher.pdf',
    'Invoice_RetouchingServices_20260328.pdf',
    now() - interval '5 days',
    '{"invoice_number": "INV-2026-047", "items": [{"description": "Image retouching (120 images)", "amount": 3000.00}, {"description": "Color grading", "amount": 200.00}], "total": 3200.00}'::jsonb,
    'completed',
    now() - interval '4 days',
    now() - interval '2 days'
  );

-- Campaign 2, Props - Invoice Submitted
INSERT INTO public.vendor_invoices (id, campaign_vendor_id, file_url, file_name, submitted_at, parsed_data, parse_status, parsed_at)
VALUES
  (
    'inv00000-0000-0000-0000-000000000002'::uuid,
    'cv000000-0000-0000-0000-000000000008'::uuid,
    'files/demo-mode/invoices/inv-002-props.pdf',
    'Invoice_SetDressingProLLC_20260327.pdf',
    now() - interval '3 days',
    '{"invoice_number": "INV-KIM-0156", "items": [{"description": "Prop sourcing and rentals", "amount": 5000.00}, {"description": "Set dressing labor (3 days)", "amount": 3000.00}, {"description": "Delivery and setup", "amount": 200.00}], "total": 8200.00}'::jsonb,
    'completed',
    now() - interval '2 days'
  );

-- Campaign 3, Retoucher - Invoice Submitted
INSERT INTO public.vendor_invoices (id, campaign_vendor_id, file_url, file_name, submitted_at, parsed_data, parse_status, parsed_at)
VALUES
  (
    'inv00000-0000-0000-0000-000000000003'::uuid,
    'cv000000-0000-0000-0000-000000000012'::uuid,
    'files/demo-mode/invoices/inv-003-retoucher.pdf',
    'Invoice_PostProductionMasters_20260326.pdf',
    now() - interval '2 days',
    '{"invoice_number": "INV-WU-0892", "items": [{"description": "Image retouching (72 images)", "amount": 1800.00}], "total": 1800.00}'::jsonb,
    'completed',
    now() - interval '1 day'
  );

-- Campaign 3, Photographer - Invoice Approved
INSERT INTO public.vendor_invoices (id, campaign_vendor_id, file_url, file_name, submitted_at, parsed_data, parse_status, parsed_at, hop_approved_at)
VALUES
  (
    'inv00000-0000-0000-0000-000000000004'::uuid,
    'cv000000-0000-0000-0000-000000000009'::uuid,
    'files/demo-mode/invoices/inv-004-photographer.pdf',
    'Invoice_SarahChenPhotography_20260320.pdf',
    now() - interval '8 days',
    '{"invoice_number": "INV-CHEN-2045", "items": [{"description": "Lead photography (1 day)", "amount": 3000.00}, {"description": "Assistant", "amount": 600.00}, {"description": "Travel and meals", "amount": 1600.00}], "total": 5200.00}'::jsonb,
    'completed',
    now() - interval '7 days',
    now() - interval '3 days'
  );

-- Campaign 4, Photographer - Paid
UPDATE public.campaign_vendors
SET payment_amount = 7500.00, payment_date = (now() - interval '10 days')::date
WHERE id = 'cv000000-0000-0000-0000-000000000014'::uuid;

-- Campaign 4, Retoucher - Paid
UPDATE public.campaign_vendors
SET payment_amount = 2900.00, payment_date = (now() - interval '8 days')::date
WHERE id = 'cv000000-0000-0000-0000-000000000016'::uuid;

-- Campaign 4, Studio - Paid
UPDATE public.campaign_vendors
SET payment_amount = 9200.00, payment_date = (now() - interval '12 days')::date
WHERE id = 'cv000000-0000-0000-0000-000000000013'::uuid;
