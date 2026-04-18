-- ============================================================
-- 069: Asset Studio — storage buckets, brand seed v1, Designer test user
-- ============================================================

-- ------------------------------------------------------------
-- Storage buckets
-- (Idempotent: won't re-insert if bucket already exists.)
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Template thumbnails and layer source images (image assets used in template authoring)
  ('templates',    'templates',    true,  52428800,  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  -- Rendered variants (the output of a run)
  ('variants',     'variants',     true,  52428800,  ARRAY['image/png','image/jpeg','image/webp']),
  -- Brand assets: logos, lock-up marks, font files, anything referenced by brand_tokens
  ('brand-assets', 'brand-assets', true,  52428800,  ARRAY['image/png','image/jpeg','image/webp','image/svg+xml','font/woff','font/woff2','font/ttf','font/otf'])
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Storage RLS
-- ------------------------------------------------------------

-- Read: any authenticated user (all three buckets are read-many)
DROP POLICY IF EXISTS "asset_studio_storage_select" ON storage.objects;
CREATE POLICY "asset_studio_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('templates', 'variants', 'brand-assets'));

-- Upload: Designer + Admin + Producer + Post Producer
DROP POLICY IF EXISTS "asset_studio_storage_insert" ON storage.objects;
CREATE POLICY "asset_studio_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('templates', 'variants', 'brand-assets')
    AND auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer')
  );

-- Update/delete: same roles that can upload
DROP POLICY IF EXISTS "asset_studio_storage_update" ON storage.objects;
CREATE POLICY "asset_studio_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('templates', 'variants', 'brand-assets')
    AND auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer', 'Designer')
  );

DROP POLICY IF EXISTS "asset_studio_storage_delete" ON storage.objects;
CREATE POLICY "asset_studio_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('templates', 'variants', 'brand-assets')
    AND auth.jwt() ->> 'role' IN ('Admin', 'Designer')
  );

-- ------------------------------------------------------------
-- Seed: Publix brand tokens v1 (documented values from globals.css)
--
-- This is a "good enough" seed so the Template Builder and render
-- pipeline have something to reference from day 1. A real Publix
-- designer should replace via the Brand console when onboarded.
-- ------------------------------------------------------------

INSERT INTO brand_tokens (brand, version, is_active, notes, tokens)
VALUES (
  'Publix',
  1,
  true,
  'Seeded from portal-v2/app/globals.css — primary #69A925, sidebar #10442B, Inter type stack. Replace with real Publix kit when available.',
  jsonb_build_object(
    'colors', jsonb_build_object(
      'primary',       '#69A925',
      'primary_hover', '#5a9420',
      'primary_light', '#e8f5e0',
      'sidebar',       '#10442B',
      'sidebar_hover', '#4A7458',
      'surface',       '#FFFFFF',
      'surface_secondary', '#F5F7F5',
      'border',        '#D9D9D9',
      'text_primary',  '#1F1F1F',
      'text_secondary','#6b7280',
      'success',       '#059669',
      'warning',       '#d97706',
      'error',         '#dc2626'
    ),
    'typography', jsonb_build_object(
      'font_family', 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      'scale', jsonb_build_object(
        'display', 32,
        'h1',      24,
        'h2',      20,
        'h3',      16,
        'body',    14,
        'meta',    12,
        'micro',   11
      ),
      'weights', jsonb_build_object(
        'regular', 400,
        'medium',  500,
        'semibold', 600,
        'bold',    700
      )
    ),
    'logo', jsonb_build_object(
      'primary_url', '/greenroom-logo.png',
      'wordmark_only', true,
      'min_width_px', 120,
      'clear_space_pct', 0.25
    ),
    'spacing', jsonb_build_object(
      'base_unit', 8,
      'radius_sm', 4,
      'radius_md', 6,
      'radius_lg', 8
    )
  )::jsonb
)
ON CONFLICT (brand, version) DO NOTHING;

-- ------------------------------------------------------------
-- Seed: Designer test user (designer@test.local)
--
-- The auth.users row must be created via Supabase admin API
-- (same pattern as admin@test.local / producer@test.local).
-- This migration upserts the public.users profile row IF the
-- auth row exists, so it's safe to run before OR after the
-- auth user is created.
-- ------------------------------------------------------------

DO $$
DECLARE
  designer_id uuid;
BEGIN
  SELECT id INTO designer_id
    FROM auth.users
    WHERE email = 'designer@test.local'
    LIMIT 1;

  IF designer_id IS NOT NULL THEN
    INSERT INTO public.users
      (id, email, name, role, active, favorite_publix_product, onboarding_completed)
    VALUES
      (designer_id, 'designer@test.local', 'Design Lead', 'Designer', true,
       'Apron', true)
    ON CONFLICT (id) DO UPDATE SET
      role   = 'Designer',
      active = true,
      name   = COALESCE(NULLIF(public.users.name, ''), 'Design Lead');
  ELSE
    RAISE NOTICE
      'Auth user for designer@test.local not found. Create via Supabase admin API, then re-run this migration or insert into public.users manually.';
  END IF;
END $$;
