-- ============================================================
-- Migration 043: Seed two gear kits
-- Photo Travel Kit and Studio Lighting Kit
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
  v_kit1_id uuid := gen_random_uuid();
  v_kit2_id uuid := gen_random_uuid();
  v_item_id uuid;
BEGIN
  -- Get first admin/producer user for created_by
  SELECT id INTO v_user_id FROM public.users WHERE role IN ('Admin', 'Producer') LIMIT 1;

  -- If no user found, skip seeding
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No admin/producer user found, skipping kit seed';
    RETURN;
  END IF;

  -- Kit 1: Photo Travel Kit
  INSERT INTO public.gear_kits (id, name, description, created_by, is_favorite)
  VALUES (
    v_kit1_id,
    'Photo Travel Kit',
    'Compact setup for on-location food photography shoots',
    v_user_id,
    true
  );

  -- Add up to 3 available gear items to kit 1
  FOR v_item_id IN
    SELECT id FROM public.gear_items
    WHERE section IS DISTINCT FROM 'Props'
      AND status = 'Available'
    ORDER BY created_at
    LIMIT 3
  LOOP
    INSERT INTO public.gear_kit_items (kit_id, gear_item_id)
    VALUES (v_kit1_id, v_item_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Kit 2: Studio Lighting Kit
  INSERT INTO public.gear_kits (id, name, description, created_by, is_favorite)
  VALUES (
    v_kit2_id,
    'Studio Lighting Kit',
    'Standard lighting rig for in-studio product and food shoots',
    v_user_id,
    false
  );

  -- Add next 3 available gear items to kit 2
  FOR v_item_id IN
    SELECT id FROM public.gear_items
    WHERE section IS DISTINCT FROM 'Props'
      AND status = 'Available'
      AND id NOT IN (SELECT gear_item_id FROM public.gear_kit_items WHERE kit_id = v_kit1_id)
    ORDER BY created_at
    LIMIT 3
  LOOP
    INSERT INTO public.gear_kit_items (kit_id, gear_item_id)
    VALUES (v_kit2_id, v_item_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
