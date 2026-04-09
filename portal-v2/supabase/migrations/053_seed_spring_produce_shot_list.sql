-- ============================================================
-- Migration 053: Seed Spring Produce shot list from concept deck
-- - Creates 2 setups:
--   1) Studio on white seamless with minimal propping
--   2) Lifestyle where people enjoy the three hero items
-- - Seeds 6 shots (3 per setup) for Morning, Sweet, Garden heroes
-- ============================================================

DO $$
DECLARE
  target_campaign_id uuid;
  studio_setup_id uuid := 'd2000001-0001-4ddd-aaaa-000000000001'::uuid;
  lifestyle_setup_id uuid := 'd2000001-0002-4ddd-aaaa-000000000002'::uuid;
BEGIN
  -- Prefer the explicit Spring Produce campaign if present.
  -- Fall back to the demo Organic Produce campaign.
  SELECT c.id
    INTO target_campaign_id
  FROM public.campaigns c
  WHERE
    lower(c.name) = lower('Spring Produce Hero Shoot')
    OR c.wf_number IN ('WF24017', 'WF-24017')
    OR lower(c.name) = lower('Organic Produce Campaign')
    OR c.wf_number = 'WF210501'
  ORDER BY
    CASE
      WHEN lower(c.name) = lower('Spring Produce Hero Shoot') THEN 1
      WHEN c.wf_number IN ('WF24017', 'WF-24017') THEN 2
      WHEN lower(c.name) = lower('Organic Produce Campaign') THEN 3
      ELSE 4
    END,
    c.created_at DESC
  LIMIT 1;

  IF target_campaign_id IS NULL THEN
    RAISE NOTICE 'No Spring/Organic produce campaign found. Skipping shot list seed.';
    RETURN;
  END IF;

  -- Replace seeded shot list rows for this campaign to keep seed deterministic.
  DELETE FROM public.shot_list_shots
  WHERE campaign_id = target_campaign_id;

  DELETE FROM public.shot_list_setups
  WHERE campaign_id = target_campaign_id;

  INSERT INTO public.shot_list_setups (
    id, campaign_id, name, description, location, media_type, sort_order
  )
  VALUES
    (
      studio_setup_id,
      target_campaign_id,
      'Studio White Seamless',
      'Clean studio hero setup on white seamless; minimal propping and precise produce styling.',
      'Studio A - White Seamless',
      'Photo',
      1
    ),
    (
      lifestyle_setup_id,
      target_campaign_id,
      'Lifestyle Gather',
      'Natural lifestyle environment where talent enjoys each spring produce hero item.',
      'Studio B - Lifestyle Kitchen / Dining',
      'Photo',
      2
    );

  INSERT INTO public.shot_list_shots (
    id,
    setup_id,
    campaign_id,
    name,
    description,
    angle,
    media_type,
    location,
    status,
    notes,
    props,
    talent,
    wardrobe,
    surface,
    lighting,
    food_styling,
    priority,
    retouching_notes,
    sort_order
  )
  VALUES
    (
      'e2000001-0001-4eee-aaaa-000000000001'::uuid,
      studio_setup_id,
      target_campaign_id,
      'Morning Hero - Layered Freshness Parfait',
      'Creamy yogurt layered with crunchy granola and sun-ripened berries. Structured, premium build for key visual.',
      '45-Degree Hero',
      'Photo',
      'Studio A - White Seamless',
      'Pending',
      'Hold clean negative space for copy lockups. Keep layer definition crisp and appetizing.',
      'Single matte white pedestal, clear glass, matte spoon only',
      '',
      '',
      'White seamless',
      'Soft key overhead-left, subtle front fill, clean edge light',
      'Build three parfait versions; choose the tallest stable stack with visible berry cross-sections',
      'High',
      'Preserve natural berry hue; remove condensation specks and seam distractions',
      1
    ),
    (
      'e2000001-0002-4eee-aaaa-000000000002'::uuid,
      studio_setup_id,
      target_campaign_id,
      'Sweet Hero - Pure Color Berry Portrait',
      'Deep red berry hero with delicate texture and juicy surface detail; nature''s candy look.',
      'Macro Detail / 30-Degree',
      'Photo',
      'Studio A - White Seamless',
      'Pending',
      'Prioritize color saturation and texture separation; no extra garnish clutter.',
      'Minimal white ceramic pinch bowl (optional)',
      '',
      '',
      'White seamless',
      'Directional side light for texture with controlled spec highlights',
      'Select uniform, premium fruit with intact crowns and no bruising',
      'High',
      'Even out red channel hotspots; clean stem fray and micro blemishes',
      2
    ),
    (
      'e2000001-0003-4eee-aaaa-000000000003'::uuid,
      studio_setup_id,
      target_campaign_id,
      'Garden Hero - Spring Greens Abundance',
      'Seasonal assortment of spring greens presented as a refined abundance statement.',
      'Overhead / Graphic',
      'Photo',
      'Studio A - White Seamless',
      'Pending',
      'Keep composition airy and intentional; avoid overfilling frame edges.',
      'White shallow bowl, one matte napkin fold',
      '',
      '',
      'White seamless',
      'Broad diffused top light with subtle bounce to maintain leaf color depth',
      'Mist greens lightly right before capture to maintain freshness without heavy droplets',
      'High',
      'Unify greens while retaining varietal contrast; remove wilted edges',
      3
    ),
    (
      'e2000001-0004-4eee-aaaa-000000000004'::uuid,
      lifestyle_setup_id,
      target_campaign_id,
      'Morning Hero Lifestyle - Breakfast Enjoyment',
      'Talent enjoying the layered parfait at a bright spring breakfast table.',
      'Eye Level / Medium',
      'Photo',
      'Studio B - Lifestyle Kitchen / Dining',
      'Pending',
      'Capture authentic bite and smile moments; keep table styling light and believable.',
      'Neutral ceramic bowls, clear water glass, light linen',
      'Two adults',
      'Soft spring casual in creams, pale sage, and light denim',
      'Light oak dining table',
      'Natural window key with soft overhead fill',
      'Maintain parfait structure in hero bowl; keep backup builds at hand',
      'High',
      'Balance skin tone warmth and food color; remove distracting crumbs',
      1
    ),
    (
      'e2000001-0005-4eee-aaaa-000000000005'::uuid,
      lifestyle_setup_id,
      target_campaign_id,
      'Sweet Hero Lifestyle - Shared Berry Snack',
      'Candid social moment of talent sharing and tasting berries, emphasizing color and freshness.',
      'Eye Level / Tight Wide',
      'Photo',
      'Studio B - Lifestyle Kitchen / Dining',
      'Pending',
      'Prioritize interaction and hand gestures; fruit should remain the visual anchor.',
      'Small neutral serving bowl, linen napkin',
      'Three adults',
      'Soft spring tones; no heavy patterns or logos',
      'Lifestyle tabletop',
      'Natural side light with negative fill for shape',
      'Stage mixed berry sizes for visual rhythm and easy pick-up action',
      'High',
      'Clean fingertips/stains as needed; keep berry color rich but natural',
      2
    ),
    (
      'e2000001-0006-4eee-aaaa-000000000006'::uuid,
      lifestyle_setup_id,
      target_campaign_id,
      'Garden Hero Lifestyle - Spring Greens Lunch',
      'Friends enjoying a spring greens salad, communicating seasonal abundance and ease.',
      'Eye Level / Wide',
      'Photo',
      'Studio B - Lifestyle Kitchen / Dining',
      'Pending',
      'Show active serving and eating beats; preserve clean composition with lived-in realism.',
      'Large salad bowl, simple servers, clear tumblers',
      'Three adults',
      'Casual spring layers in neutrals and muted greens',
      'Lifestyle dining table',
      'Window-motivated key with soft bounce and gentle back separation',
      'Toss greens moments before each take to keep leaf volume and gloss',
      'High',
      'Retain leaf texture; reduce harsh hotspot reflections on dressing',
      3
    );
END $$;
