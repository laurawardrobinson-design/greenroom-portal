-- SOC 2 hardening pass.
--
-- Three goals:
--   1. Vendor data isolation enforced at the database level — vendors only
--      see campaigns they're assigned to via campaign_vendors.
--   2. Replace migration 067's broken auth.jwt() ->> 'role' role checks with
--      the working current_user_has_role() helper from migration 070.
--   3. Extend audit logging (migration 039) to a few more high-value tables.
--
-- Helper functions reused (defined elsewhere — do not redefine here):
--   public.get_my_role()              — migration 006
--   public.get_my_vendor_id()         — migration 006
--   public.current_user_has_role()    — migration 070
--   public.audit_trigger_fn()         — migration 039
--
-- Studio-wide assets (brand_tokens, templates, variants, etc.) are intentionally
-- left readable by all authenticated users — vendors need brand assets to do
-- their work. Only campaign-scoped or internal-only data is tightened.

BEGIN;

-- ============================================================================
-- 1. Internal-only tables (vendors get NO read access)
-- ============================================================================

-- product_notes
DROP POLICY IF EXISTS "Authenticated users can read product notes" ON public.product_notes;
CREATE POLICY "product_notes_internal_select" ON public.product_notes FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');

-- gear_notes
DROP POLICY IF EXISTS "Authenticated users can read gear notes" ON public.gear_notes;
CREATE POLICY "gear_notes_internal_select" ON public.gear_notes FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');

-- user_notes
DROP POLICY IF EXISTS "Authenticated users can read user notes" ON public.user_notes;
CREATE POLICY "user_notes_internal_select" ON public.user_notes FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');

-- vendor_praise_notes (about vendors, written by internal users)
DROP POLICY IF EXISTS "Authenticated users can read vendor praise notes" ON public.vendor_praise_notes;
CREATE POLICY "vendor_praise_notes_internal_select" ON public.vendor_praise_notes FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');

-- highlights
DROP POLICY IF EXISTS "Authenticated users can read highlights" ON public.highlights;
DROP POLICY IF EXISTS "Admin users can manage highlights" ON public.highlights;
CREATE POLICY "highlights_internal_select" ON public.highlights FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "highlights_admin_write" ON public.highlights FOR ALL TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']))
  WITH CHECK (public.current_user_has_role(ARRAY['Admin']));

-- user_goals (internal team tool)
DROP POLICY IF EXISTS "Authenticated users can read all goals" ON public.user_goals;
CREATE POLICY "user_goals_internal_select" ON public.user_goals FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');

-- studio_goals (internal team tool)
DROP POLICY IF EXISTS "All authenticated users can read studio goals" ON public.studio_goals;
CREATE POLICY "studio_goals_internal_select" ON public.studio_goals FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');

-- campaign_producers (admin/producer routing — never vendor-relevant)
ALTER TABLE public.campaign_producers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_producers_internal_select" ON public.campaign_producers FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "campaign_producers_admin_write" ON public.campaign_producers FOR ALL TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer']))
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer']));

-- ============================================================================
-- 2. Migration 067 fix — replace broken auth.jwt() ->> 'role' with helper.
--    Also tighten SELECT to internal-only (post-production is internal work).
-- ============================================================================

-- edit_rooms
DROP POLICY IF EXISTS "edit_rooms_select" ON edit_rooms;
DROP POLICY IF EXISTS "edit_rooms_insert" ON edit_rooms;
DROP POLICY IF EXISTS "edit_rooms_update" ON edit_rooms;
CREATE POLICY "edit_rooms_internal_select" ON edit_rooms FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "edit_rooms_insert" ON edit_rooms FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "edit_rooms_update" ON edit_rooms FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));

-- edit_room_reservations
DROP POLICY IF EXISTS "edit_room_reservations_select" ON edit_room_reservations;
DROP POLICY IF EXISTS "edit_room_reservations_insert" ON edit_room_reservations;
DROP POLICY IF EXISTS "edit_room_reservations_update" ON edit_room_reservations;
DROP POLICY IF EXISTS "edit_room_reservations_delete" ON edit_room_reservations;
CREATE POLICY "edit_room_reservations_internal_select" ON edit_room_reservations FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "edit_room_reservations_insert" ON edit_room_reservations FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "edit_room_reservations_update" ON edit_room_reservations FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "edit_room_reservations_delete" ON edit_room_reservations FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));

-- media_drives
DROP POLICY IF EXISTS "media_drives_select" ON media_drives;
DROP POLICY IF EXISTS "media_drives_insert" ON media_drives;
DROP POLICY IF EXISTS "media_drives_update" ON media_drives;
DROP POLICY IF EXISTS "media_drives_delete" ON media_drives;
CREATE POLICY "media_drives_internal_select" ON media_drives FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "media_drives_insert" ON media_drives FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "media_drives_update" ON media_drives FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "media_drives_delete" ON media_drives FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin']));

-- drive_checkout_sessions
DROP POLICY IF EXISTS "drive_checkout_sessions_select" ON drive_checkout_sessions;
DROP POLICY IF EXISTS "drive_checkout_sessions_insert" ON drive_checkout_sessions;
DROP POLICY IF EXISTS "drive_checkout_sessions_update" ON drive_checkout_sessions;
CREATE POLICY "drive_checkout_sessions_internal_select" ON drive_checkout_sessions FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "drive_checkout_sessions_insert" ON drive_checkout_sessions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "drive_checkout_sessions_update" ON drive_checkout_sessions FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));

-- drive_checkout_items
DROP POLICY IF EXISTS "drive_checkout_items_select" ON drive_checkout_items;
DROP POLICY IF EXISTS "drive_checkout_items_insert" ON drive_checkout_items;
DROP POLICY IF EXISTS "drive_checkout_items_update" ON drive_checkout_items;
CREATE POLICY "drive_checkout_items_internal_select" ON drive_checkout_items FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "drive_checkout_items_insert" ON drive_checkout_items FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "drive_checkout_items_update" ON drive_checkout_items FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));

-- drive_reservations
DROP POLICY IF EXISTS "drive_reservations_select" ON drive_reservations;
DROP POLICY IF EXISTS "drive_reservations_insert" ON drive_reservations;
DROP POLICY IF EXISTS "drive_reservations_update" ON drive_reservations;
DROP POLICY IF EXISTS "drive_reservations_delete" ON drive_reservations;
CREATE POLICY "drive_reservations_internal_select" ON drive_reservations FOR SELECT TO authenticated
  USING (public.get_my_role() <> 'Vendor');
CREATE POLICY "drive_reservations_insert" ON drive_reservations FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "drive_reservations_update" ON drive_reservations FOR UPDATE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));
CREATE POLICY "drive_reservations_delete" ON drive_reservations FOR DELETE TO authenticated
  USING (public.current_user_has_role(ARRAY['Admin', 'Producer', 'Post Producer']));

-- ============================================================================
-- 3. Campaign-scoped tables — vendors see only their assigned campaigns
-- ============================================================================

-- shot_talent (has campaign_id directly)
DROP POLICY IF EXISTS "Authenticated users can read shot_talent" ON public.shot_talent;
DROP POLICY IF EXISTS "Authenticated users can insert shot_talent" ON public.shot_talent;
DROP POLICY IF EXISTS "Authenticated users can update shot_talent" ON public.shot_talent;
DROP POLICY IF EXISTS "Authenticated users can delete shot_talent" ON public.shot_talent;
CREATE POLICY "shot_talent_scoped_select" ON public.shot_talent FOR SELECT TO authenticated
  USING (
    public.get_my_role() <> 'Vendor'
    OR campaign_id IN (SELECT campaign_id FROM public.campaign_vendors WHERE vendor_id = public.get_my_vendor_id())
  );
CREATE POLICY "shot_talent_internal_write" ON public.shot_talent FOR ALL TO authenticated
  USING (public.get_my_role() <> 'Vendor')
  WITH CHECK (public.get_my_role() <> 'Vendor');

-- shot_list_setups (has campaign_id)
ALTER TABLE public.shot_list_setups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shot_list_setups_scoped_select" ON public.shot_list_setups FOR SELECT TO authenticated
  USING (
    public.get_my_role() <> 'Vendor'
    OR campaign_id IN (SELECT campaign_id FROM public.campaign_vendors WHERE vendor_id = public.get_my_vendor_id())
  );
CREATE POLICY "shot_list_setups_internal_write" ON public.shot_list_setups FOR ALL TO authenticated
  USING (public.get_my_role() <> 'Vendor')
  WITH CHECK (public.get_my_role() <> 'Vendor');

-- shot_list_shots (has campaign_id)
ALTER TABLE public.shot_list_shots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shot_list_shots_scoped_select" ON public.shot_list_shots FOR SELECT TO authenticated
  USING (
    public.get_my_role() <> 'Vendor'
    OR campaign_id IN (SELECT campaign_id FROM public.campaign_vendors WHERE vendor_id = public.get_my_vendor_id())
  );
CREATE POLICY "shot_list_shots_internal_write" ON public.shot_list_shots FOR ALL TO authenticated
  USING (public.get_my_role() <> 'Vendor')
  WITH CHECK (public.get_my_role() <> 'Vendor');

-- shot_deliverable_links (joins through shot_id → shot_list_shots.campaign_id)
ALTER TABLE public.shot_deliverable_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shot_deliverable_links_scoped_select" ON public.shot_deliverable_links FOR SELECT TO authenticated
  USING (
    public.get_my_role() <> 'Vendor'
    OR EXISTS (
      SELECT 1 FROM public.shot_list_shots s
      JOIN public.campaign_vendors cv ON cv.campaign_id = s.campaign_id
      WHERE s.id = shot_deliverable_links.shot_id
        AND cv.vendor_id = public.get_my_vendor_id()
    )
  );
CREATE POLICY "shot_deliverable_links_internal_write" ON public.shot_deliverable_links FOR ALL TO authenticated
  USING (public.get_my_role() <> 'Vendor')
  WITH CHECK (public.get_my_role() <> 'Vendor');

-- shoot_day_events (joins through shoot_date_id → shoot_dates.shoot_id → shoots.campaign_id)
ALTER TABLE public.shoot_day_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shoot_day_events_scoped_select" ON public.shoot_day_events FOR SELECT TO authenticated
  USING (
    public.get_my_role() <> 'Vendor'
    OR EXISTS (
      SELECT 1 FROM public.shoot_dates sd
      JOIN public.shoots sh ON sh.id = sd.shoot_id
      JOIN public.campaign_vendors cv ON cv.campaign_id = sh.campaign_id
      WHERE sd.id = shoot_day_events.shoot_date_id
        AND cv.vendor_id = public.get_my_vendor_id()
    )
  );
CREATE POLICY "shoot_day_events_internal_write" ON public.shoot_day_events FOR ALL TO authenticated
  USING (public.get_my_role() <> 'Vendor')
  WITH CHECK (public.get_my_role() <> 'Vendor');

-- ============================================================================
-- 4. Extend audit logging (audit_trigger_fn lives in migration 039)
-- ============================================================================

DROP TRIGGER IF EXISTS audit_campaign_deliverables ON public.campaign_deliverables;
CREATE TRIGGER audit_campaign_deliverables
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_shot_list_shots ON public.shot_list_shots;
CREATE TRIGGER audit_shot_list_shots
  AFTER INSERT OR UPDATE OR DELETE ON public.shot_list_shots
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_campaign_assets ON public.campaign_assets;
CREATE TRIGGER audit_campaign_assets
  AFTER INSERT OR UPDATE OR DELETE ON public.campaign_assets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_dam_asset_products ON public.dam_asset_products;
CREATE TRIGGER audit_dam_asset_products
  AFTER INSERT OR UPDATE OR DELETE ON public.dam_asset_products
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

COMMIT;
