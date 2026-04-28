-- ============================================================
-- 104: Seed Nicole's Brand Marketing portfolio
-- ============================================================
--
-- Nicole is the dev Brand Marketing Manager (bmm@test.local). Her
-- auth UUID can vary by local database, so assign the demo portfolio
-- by email instead of relying on the older hardcoded UUID.
-- ============================================================

DO $$
DECLARE
  nicole_id uuid;
BEGIN
  SELECT id INTO nicole_id
  FROM public.users
  WHERE email = 'bmm@test.local'
     OR (role = 'Brand Marketing Manager' AND name = 'Nicole Lee')
  ORDER BY CASE WHEN email = 'bmm@test.local' THEN 0 ELSE 1 END
  LIMIT 1;

  IF nicole_id IS NULL THEN
    RAISE NOTICE 'Nicole BMM user not found. Dev login will assign demo campaigns when bmm@test.local is created.';
    RETURN;
  END IF;

  UPDATE public.users
  SET role = 'Brand Marketing Manager',
      name = COALESCE(NULLIF(name, ''), 'Nicole Lee'),
      desk_department = COALESCE(desk_department, 'Bakery'),
      active = true
  WHERE id = nicole_id;

  UPDATE public.campaigns
  SET brand_owner_id = nicole_id
  WHERE brand_owner_id = '19e8a840-2935-4c41-bd4d-4b8d1c51aff0';

  UPDATE public.campaigns
  SET brand_owner_id = nicole_id,
      line_of_business = CASE id
        WHEN '6e5bfb11-91f6-4472-a298-b98f925b6b6b' THEN 'Produce'
        WHEN 'a1b2c3d4-1111-4aaa-bbbb-000000000001' THEN 'Meat & Seafood'
        WHEN 'a1b2c3d4-2222-4aaa-bbbb-000000000002' THEN 'Grocery'
        WHEN 'a1b2c3d4-3333-4aaa-bbbb-000000000003' THEN 'Bakery'
        WHEN '7318c8f3-aba4-48df-89ac-819141aece0f' THEN 'Bakery'
        ELSE line_of_business
      END
  WHERE id IN (
    '6e5bfb11-91f6-4472-a298-b98f925b6b6b',
    'a1b2c3d4-1111-4aaa-bbbb-000000000001',
    'a1b2c3d4-2222-4aaa-bbbb-000000000002',
    'a1b2c3d4-3333-4aaa-bbbb-000000000003',
    '7318c8f3-aba4-48df-89ac-819141aece0f'
  );
END $$;

NOTIFY pgrst, 'reload schema';
