-- ============================================================
-- Migration 006: Row Level Security Policies
-- Defense-in-depth: even if API guards fail, the database
-- itself restricts what each user can see/modify.
-- ============================================================

-- Helper: get the current user's role from our users table
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get the current user's vendor_id (NULL for non-vendors)
CREATE OR REPLACE FUNCTION public.get_my_vendor_id()
RETURNS uuid AS $$
  SELECT vendor_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shoot_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_maintenance ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS
-- ============================================================

CREATE POLICY "users_select" ON public.users FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "users_update_self" ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_admin_all" ON public.users FOR ALL
  USING (get_my_role() = 'Admin');

-- ============================================================
-- BUDGET POOLS — Admin and Producer only
-- ============================================================

CREATE POLICY "budget_pools_select" ON public.budget_pools FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "budget_pools_admin" ON public.budget_pools FOR ALL
  USING (get_my_role() = 'Admin');

-- ============================================================
-- CAMPAIGNS
-- Admin/Producer: see all
-- Studio: see campaigns they're crew on
-- Vendor: see campaigns they're assigned to
-- ============================================================

CREATE POLICY "campaigns_admin_producer" ON public.campaigns FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "campaigns_studio" ON public.campaigns FOR SELECT
  USING (
    get_my_role() = 'Studio'
    AND id IN (SELECT campaign_id FROM campaign_crew WHERE user_id = auth.uid())
  );

CREATE POLICY "campaigns_vendor" ON public.campaigns FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND id IN (
      SELECT campaign_id FROM campaign_vendors
      WHERE vendor_id = get_my_vendor_id()
    )
  );

CREATE POLICY "campaigns_modify" ON public.campaigns FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- SHOOT DAYS — follows campaign access
-- ============================================================

CREATE POLICY "shoot_days_select" ON public.shoot_days FOR SELECT
  USING (
    campaign_id IN (SELECT id FROM campaigns)  -- leverages campaigns RLS
  );

CREATE POLICY "shoot_days_modify" ON public.shoot_days FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- CAMPAIGN DELIVERABLES — follows campaign access
-- ============================================================

CREATE POLICY "deliverables_select" ON public.campaign_deliverables FOR SELECT
  USING (campaign_id IN (SELECT id FROM campaigns));

CREATE POLICY "deliverables_modify" ON public.campaign_deliverables FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- CAMPAIGN CREW — follows campaign access
-- ============================================================

CREATE POLICY "crew_select" ON public.campaign_crew FOR SELECT
  USING (campaign_id IN (SELECT id FROM campaigns));

CREATE POLICY "crew_modify" ON public.campaign_crew FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- CAMPAIGN ASSETS — Fun/Boring split handled at API level
-- Vendors see only their own campaign assets
-- ============================================================

CREATE POLICY "assets_admin_producer" ON public.campaign_assets FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "assets_studio" ON public.campaign_assets FOR SELECT
  USING (
    get_my_role() = 'Studio'
    AND campaign_id IN (SELECT campaign_id FROM campaign_crew WHERE user_id = auth.uid())
  );

CREATE POLICY "assets_vendor" ON public.campaign_assets FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND campaign_id IN (
      SELECT campaign_id FROM campaign_vendors
      WHERE vendor_id = get_my_vendor_id()
    )
  );

CREATE POLICY "assets_insert" ON public.campaign_assets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- VENDORS — Admin/Producer see all, Vendor sees own record
-- ============================================================

CREATE POLICY "vendors_admin_producer" ON public.vendors FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "vendors_studio" ON public.vendors FOR SELECT
  USING (get_my_role() = 'Studio');

CREATE POLICY "vendors_self" ON public.vendors FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND id = get_my_vendor_id()
  );

CREATE POLICY "vendors_modify" ON public.vendors FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- CAMPAIGN VENDORS (PO lifecycle)
-- CRITICAL: Vendor isolation — only see own assignments
-- ============================================================

CREATE POLICY "cv_admin_producer" ON public.campaign_vendors FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "cv_vendor_own" ON public.campaign_vendors FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND vendor_id = get_my_vendor_id()
  );

CREATE POLICY "cv_vendor_update" ON public.campaign_vendors FOR UPDATE
  USING (
    get_my_role() = 'Vendor'
    AND vendor_id = get_my_vendor_id()
  );

CREATE POLICY "cv_modify" ON public.campaign_vendors FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- VENDOR ESTIMATE ITEMS — follows campaign_vendors access
-- ============================================================

CREATE POLICY "estimate_items_admin_producer" ON public.vendor_estimate_items FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "estimate_items_vendor" ON public.vendor_estimate_items FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND campaign_vendor_id IN (
      SELECT id FROM campaign_vendors WHERE vendor_id = get_my_vendor_id()
    )
  );

CREATE POLICY "estimate_items_insert_vendor" ON public.vendor_estimate_items FOR INSERT
  WITH CHECK (
    campaign_vendor_id IN (
      SELECT id FROM campaign_vendors WHERE vendor_id = get_my_vendor_id()
    )
    OR get_my_role() IN ('Admin', 'Producer')
  );

CREATE POLICY "estimate_items_modify" ON public.vendor_estimate_items FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- VENDOR INVOICES — follows campaign_vendors access
-- ============================================================

CREATE POLICY "invoices_admin_producer" ON public.vendor_invoices FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "invoices_vendor" ON public.vendor_invoices FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND campaign_vendor_id IN (
      SELECT id FROM campaign_vendors WHERE vendor_id = get_my_vendor_id()
    )
  );

CREATE POLICY "invoices_modify" ON public.vendor_invoices FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- VENDOR INVOICE ITEMS
-- ============================================================

CREATE POLICY "invoice_items_admin_producer" ON public.vendor_invoice_items FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "invoice_items_vendor" ON public.vendor_invoice_items FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND invoice_id IN (
      SELECT vi.id FROM vendor_invoices vi
      JOIN campaign_vendors cv ON cv.id = vi.campaign_vendor_id
      WHERE cv.vendor_id = get_my_vendor_id()
    )
  );

CREATE POLICY "invoice_items_modify" ON public.vendor_invoice_items FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- ============================================================
-- BUDGET REQUESTS — Admin and Producer
-- ============================================================

CREATE POLICY "budget_requests_select" ON public.budget_requests FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "budget_requests_insert" ON public.budget_requests FOR INSERT
  WITH CHECK (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "budget_requests_admin" ON public.budget_requests FOR ALL
  USING (get_my_role() = 'Admin');

-- ============================================================
-- GEAR TABLES — Admin, Producer, Studio only (no Vendor access)
-- ============================================================

CREATE POLICY "gear_items_select" ON public.gear_items FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_items_modify" ON public.gear_items FOR ALL
  USING (get_my_role() IN ('Admin', 'Studio'));

CREATE POLICY "gear_checkouts_select" ON public.gear_checkouts FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_checkouts_insert" ON public.gear_checkouts FOR INSERT
  WITH CHECK (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_reservations_select" ON public.gear_reservations FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_reservations_modify" ON public.gear_reservations FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_kits_select" ON public.gear_kits FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_kits_modify" ON public.gear_kits FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_kit_items_select" ON public.gear_kit_items FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_kit_items_modify" ON public.gear_kit_items FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_maintenance_select" ON public.gear_maintenance FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer', 'Studio'));

CREATE POLICY "gear_maintenance_modify" ON public.gear_maintenance FOR ALL
  USING (get_my_role() IN ('Admin', 'Studio'));
