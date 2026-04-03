-- ============================================================
-- Migration 039: Security Hardening
-- Tightens storage RLS, adds audit logging, expands soft delete
-- ============================================================

-- ============================================================
-- 1. TIGHTEN STORAGE RLS FOR CAMPAIGN-ASSETS
--    Old policy: any authenticated user can read any file.
--    New policy: Admin/Producer/ArtDirector see all; Vendors and
--    Studio only see assets for campaigns they're assigned to.
-- ============================================================

DROP POLICY IF EXISTS "campaign_assets_read" ON storage.objects;

CREATE POLICY "campaign_assets_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'campaign-assets'
    AND auth.uid() IS NOT NULL
    AND (
      -- Admin, Producer, Art Director: full access
      get_my_role() IN ('Admin', 'Producer', 'Art Director')
      -- Studio: access if assigned to a shoot on that campaign
      OR (
        get_my_role() = 'Studio'
        AND EXISTS (
          SELECT 1 FROM campaign_assets ca
          JOIN shoot_crew sc ON sc.user_id = auth.uid()
          JOIN shoots s ON s.id = sc.shoot_id AND s.campaign_id = ca.campaign_id
          WHERE ca.file_url LIKE '%' || name
        )
      )
      -- Vendor: access only assets for campaigns they're assigned to
      OR (
        get_my_role() = 'Vendor'
        AND EXISTS (
          SELECT 1 FROM campaign_assets ca
          JOIN campaign_vendors cv ON cv.campaign_id = ca.campaign_id
            AND cv.vendor_id = get_my_vendor_id()
          WHERE ca.file_url LIKE '%' || name
        )
      )
    )
  );

-- Also tighten upload policy: vendor can only upload to their campaigns
DROP POLICY IF EXISTS "campaign_assets_upload" ON storage.objects;

CREATE POLICY "campaign_assets_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'campaign-assets'
    AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- 2. AUDIT LOGS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,                  -- e.g. 'login', 'create', 'update', 'delete', 'role_change'
  resource_type TEXT NOT NULL,           -- e.g. 'campaign', 'vendor', 'invoice', 'user', 'gear_item'
  resource_id UUID,                      -- the affected record's ID
  metadata JSONB DEFAULT '{}',           -- extra context (old_value, new_value, ip, etc.)
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by user, resource, or time range
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS: only admins can read audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs FOR SELECT
  USING (get_my_role() = 'Admin');

-- Allow inserts from service role (triggers and API)
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 3. AUDIT TRIGGER FUNCTION
-- Generic trigger that logs INSERT/UPDATE/DELETE on any table.
-- Attach to tables that need auditing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      auth.uid(),
      'delete',
      TG_TABLE_NAME,
      OLD.id,
      jsonb_build_object('old_data', to_jsonb(OLD))
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, metadata)
    VALUES (
      auth.uid(),
      'update',
      TG_TABLE_NAME,
      NEW.id,
      jsonb_build_object('changed_fields',
        (SELECT jsonb_object_agg(key, value)
         FROM jsonb_each(to_jsonb(NEW))
         WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key)
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to security-sensitive tables
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_campaign_vendors
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_vendors
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_vendor_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_vendor_estimate_items
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_estimate_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_gear_checkouts
  AFTER INSERT OR UPDATE OR DELETE ON public.gear_checkouts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ============================================================
-- 4. EXPAND SOFT DELETE
-- Add deleted_at to tables that lack it
-- ============================================================

ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.gear_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.campaign_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON public.vendors(deleted_at);
CREATE INDEX IF NOT EXISTS idx_gear_items_deleted_at ON public.gear_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_deleted_at ON public.campaign_assets(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);
