-- ============================================================
-- 070: Asset Studio RLS fix
--
-- 068 + 069 wrote role checks as `auth.jwt() ->> 'role'`, but this
-- app stores user roles in public.users.role (not in the JWT). The
-- claim is therefore always NULL and every INSERT/UPDATE/DELETE on
-- Asset Studio tables fails with 42501.
--
-- This migration replaces the role checks with the standard portal
-- pattern (see e.g. 033_user_goals.sql):
--
--     EXISTS (SELECT 1 FROM public.users u
--             WHERE u.id = auth.uid() AND u.role IN (...))
--
-- We encapsulate that as a small SECURITY DEFINER helper so the
-- policies stay readable and the role list lives in one place per
-- table. SECURITY DEFINER lets the function read public.users even
-- when the caller's RLS would otherwise block the row lookup.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: current user has any of the given roles
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_has_role(allowed text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = ANY (allowed)
      AND active
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_role(text[]) TO authenticated;

-- ------------------------------------------------------------
-- brand_tokens
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "brand_tokens_insert" ON brand_tokens;
DROP POLICY IF EXISTS "brand_tokens_update" ON brand_tokens;
DROP POLICY IF EXISTS "brand_tokens_delete" ON brand_tokens;

CREATE POLICY "brand_tokens_insert" ON brand_tokens FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Designer']));
CREATE POLICY "brand_tokens_update" ON brand_tokens FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Designer']));
CREATE POLICY "brand_tokens_delete" ON brand_tokens FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

-- ------------------------------------------------------------
-- templates
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "templates_insert" ON templates;
DROP POLICY IF EXISTS "templates_update" ON templates;
DROP POLICY IF EXISTS "templates_delete" ON templates;

CREATE POLICY "templates_insert" ON templates FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "templates_update" ON templates FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "templates_delete" ON templates FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Designer']));

-- ------------------------------------------------------------
-- template_layers
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "template_layers_insert" ON template_layers;
DROP POLICY IF EXISTS "template_layers_update" ON template_layers;
DROP POLICY IF EXISTS "template_layers_delete" ON template_layers;

CREATE POLICY "template_layers_insert" ON template_layers FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "template_layers_update" ON template_layers FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "template_layers_delete" ON template_layers FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));

-- ------------------------------------------------------------
-- template_output_specs
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "template_output_specs_insert" ON template_output_specs;
DROP POLICY IF EXISTS "template_output_specs_update" ON template_output_specs;
DROP POLICY IF EXISTS "template_output_specs_delete" ON template_output_specs;

CREATE POLICY "template_output_specs_insert" ON template_output_specs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "template_output_specs_update" ON template_output_specs FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "template_output_specs_delete" ON template_output_specs FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));

-- ------------------------------------------------------------
-- variant_runs
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "variant_runs_insert" ON variant_runs;
DROP POLICY IF EXISTS "variant_runs_update" ON variant_runs;
DROP POLICY IF EXISTS "variant_runs_delete" ON variant_runs;

CREATE POLICY "variant_runs_insert" ON variant_runs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "variant_runs_update" ON variant_runs FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "variant_runs_delete" ON variant_runs FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

-- ------------------------------------------------------------
-- variants
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "variants_insert" ON variants;
DROP POLICY IF EXISTS "variants_update" ON variants;
DROP POLICY IF EXISTS "variants_delete" ON variants;

CREATE POLICY "variants_insert" ON variants FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "variants_update" ON variants FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer']));
CREATE POLICY "variants_delete" ON variants FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

-- ------------------------------------------------------------
-- Storage (templates / variants / brand-assets buckets)
-- 069 wrote these against the JWT role claim too; replace them.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "asset_studio_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "asset_studio_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "asset_studio_storage_delete" ON storage.objects;

CREATE POLICY "asset_studio_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('templates', 'variants', 'brand-assets')
    AND public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer'])
  );

CREATE POLICY "asset_studio_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('templates', 'variants', 'brand-assets')
    AND public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer', 'Designer'])
  );

CREATE POLICY "asset_studio_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('templates', 'variants', 'brand-assets')
    AND public.current_user_has_role(ARRAY['Admin', 'Designer'])
  );

-- Ask PostgREST to refresh its schema cache so the newly created
-- asset-studio tables (from 068) show up in API calls immediately.
NOTIFY pgrst, 'reload schema';
