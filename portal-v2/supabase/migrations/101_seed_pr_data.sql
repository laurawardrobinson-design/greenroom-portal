-- ============================================================
-- 101: Seed Product Request data
-- ============================================================
-- Fills every auto-drafted PR doc with realistic dept sections + items
-- (one section per dept of a campaign product, one item per product),
-- and adds status variety + audit events so the PR list shows real
-- examples of draft / submitted / forwarded. (Fulfilled is part of
-- the schema's check constraint but is not used in practice — once
-- BMM forwards to the depts, the PR's job is done.)
--
-- Product rule: one active PR per campaign shoot day. If older seed
-- paths produced duplicate active docs, keep the earliest canonical doc
-- and cancel the extras before populating sections/items.
--
-- "Today" for status bucketing is hard-coded to 2026-04-26 so the
-- buckets stay stable across reseeds (matches the reseeded dates in
-- migration 100).
-- ============================================================

DELETE FROM public.product_request_events;
DELETE FROM public.product_request_items;
DELETE FROM public.product_request_dept_sections;

WITH ranked_docs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_id, shoot_date
      ORDER BY
        CASE WHEN shoot_date_id IS NULL THEN 1 ELSE 0 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.product_request_docs
  WHERE status <> 'cancelled'
)
UPDATE public.product_request_docs d
   SET status = 'cancelled',
       notes = trim(both from concat_ws(
         E'\n\n',
         nullif(d.notes, ''),
         'Seed cleanup: cancelled duplicate PR because Greenroom uses one active product request per campaign shoot day.'
       )),
       updated_at = now()
  FROM ranked_docs r
 WHERE d.id = r.id
   AND r.rn > 1;

-- One section per (doc, department-of-a-linked-product)
WITH doc_dept AS (
  SELECT DISTINCT d.id AS doc_id, d.shoot_date, p.department
  FROM public.product_request_docs d
  JOIN public.campaign_products cp ON cp.campaign_id = d.campaign_id
  JOIN public.products p ON p.id = cp.product_id
  WHERE p.department IN ('Bakery','Produce','Deli','Meat-Seafood','Grocery')
    AND d.status <> 'cancelled'
)
INSERT INTO public.product_request_dept_sections
  (id, doc_id, department, date_needed, time_needed, pickup_person, sort_order)
SELECT
  gen_random_uuid(),
  doc_id,
  department,
  shoot_date - INTERVAL '1 day',
  CASE department
    WHEN 'Bakery'       THEN '6:00 AM'
    WHEN 'Produce'      THEN '6:30 AM'
    WHEN 'Deli'         THEN '7:00 AM'
    WHEN 'Meat-Seafood' THEN '7:30 AM'
    WHEN 'Grocery'      THEN '8:00 AM'
  END,
  CASE department
    WHEN 'Bakery'  THEN 'Marcus (food stylist)'
    WHEN 'Produce' THEN 'Marcus (food stylist)'
    ELSE 'Producer pickup'
  END,
  CASE department
    WHEN 'Bakery'       THEN 1
    WHEN 'Produce'      THEN 2
    WHEN 'Deli'         THEN 3
    WHEN 'Meat-Seafood' THEN 4
    WHEN 'Grocery'      THEN 5
  END
FROM doc_dept;

-- One line item per linked product, in its dept's section
INSERT INTO public.product_request_items
  (section_id, product_id, quantity, size, special_instructions, from_shot_list, sort_order)
SELECT
  s.id,
  cp.product_id,
  CASE cp.role WHEN 'hero' THEN 6 ELSE 3 END,
  CASE p.department
    WHEN 'Produce'      THEN 'extra-large, picture-perfect'
    WHEN 'Bakery'       THEN 'standard retail size'
    WHEN 'Meat-Seafood' THEN 'thick-cut, well-marbled'
    ELSE 'standard'
  END,
  CASE WHEN cp.role='hero'
    THEN 'Hero — pick the best of the best. No bruising, blemishes, or asymmetry.'
    ELSE ''
  END,
  cp.role = 'hero',
  ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY p.name) - 1
FROM public.product_request_dept_sections s
JOIN public.product_request_docs d ON d.id = s.doc_id
JOIN public.campaign_products cp ON cp.campaign_id = d.campaign_id
JOIN public.products p
  ON p.id = cp.product_id AND p.department = s.department;

-- Status sweep: past dates → forwarded, near-term → submitted, rest → draft
WITH today AS (SELECT DATE '2026-04-26' AS d),
     producer AS (SELECT id FROM public.users WHERE email='producer@test.local'),
     bmm      AS (SELECT id FROM public.users WHERE email='bmm@test.local')
UPDATE public.product_request_docs d
SET
  status = CASE
    WHEN d.shoot_date <  (SELECT d FROM today) THEN 'forwarded'
    WHEN d.shoot_date <= (SELECT d FROM today) + INTERVAL '4 days' THEN 'submitted'
    ELSE 'draft'
  END,
  submitted_by = CASE
    WHEN d.shoot_date <= (SELECT d FROM today) + INTERVAL '4 days'
    THEN (SELECT id FROM producer)
    ELSE NULL
  END,
  submitted_at = CASE
    WHEN d.shoot_date <= (SELECT d FROM today) + INTERVAL '4 days'
    THEN (d.shoot_date - INTERVAL '5 days')::timestamptz
    ELSE NULL
  END,
  forwarded_by = CASE
    WHEN d.shoot_date < (SELECT d FROM today) THEN (SELECT id FROM bmm)
    ELSE NULL
  END,
  forwarded_at = CASE
    WHEN d.shoot_date < (SELECT d FROM today)
    THEN (d.shoot_date - INTERVAL '3 days')::timestamptz
    ELSE NULL
  END,
  fulfilled_at = NULL,
  notes = CASE
    WHEN d.shoot_date <  (SELECT d FROM today)
      THEN 'Forwarded to depts ahead of shoot. No issues reported.'
    WHEN d.shoot_date <= (SELECT d FROM today) + INTERVAL '4 days'
      THEN 'Submitted to BMM — awaiting forward to depts.'
    ELSE ''
  END
WHERE d.status <> 'cancelled';

-- Audit events
INSERT INTO public.product_request_events (doc_id, actor_id, from_status, to_status, comment, created_at)
SELECT id, submitted_by, 'draft', 'submitted', 'Submitted for BMM review.', submitted_at
FROM public.product_request_docs
WHERE status IN ('submitted','forwarded') AND submitted_at IS NOT NULL;

INSERT INTO public.product_request_events (doc_id, actor_id, from_status, to_status, comment, created_at)
SELECT id, forwarded_by, 'submitted', 'forwarded', 'Forwarded to department leads.', forwarded_at
FROM public.product_request_docs
WHERE status = 'forwarded' AND forwarded_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
