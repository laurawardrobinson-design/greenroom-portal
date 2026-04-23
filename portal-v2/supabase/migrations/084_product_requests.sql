-- ============================================================
-- 084: Product Requests (Producer → BMM routed process)
-- ============================================================
--
-- Sprint 1, Story 5. Two-phase Producer flow (in_progress → formalized)
-- then BMM-driven downstream states (§9 Decision 3). Routed to
-- Brand Marketing as a role: assigned_to is the campaign's
-- brand_owner_id; any BMM + Admin sees the formalized queue.
-- Visible company-wide to Producer/BMM/Admin/Studio so Producers
-- can discover each other's drafts for peer alignment.
--
-- Reference: portal-v2/BRAND_MARKETING_SPRINT_PLAN.md §12 Story 5.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_requests (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number          text        NOT NULL UNIQUE,
  campaign_id             uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  shoot_date_id           uuid        REFERENCES public.shoot_dates(id) ON DELETE SET NULL,
  product_id              uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  product_description     text        NOT NULL DEFAULT '',
  quantity                integer     NOT NULL DEFAULT 1,
  unit                    text        NOT NULL DEFAULT 'each',
  hero_or_swap            text        NOT NULL DEFAULT 'hero'
                          CHECK (hero_or_swap IN ('hero','swap','either')),
  delivery_by             timestamptz,
  priority                text        NOT NULL DEFAULT 'standard'
                          CHECK (priority IN ('standard','rush')),
  notes                   text        NOT NULL DEFAULT '',
  restrictions            text        NOT NULL DEFAULT '',
  line_of_business        text        CHECK (line_of_business IS NULL OR line_of_business IN (
    'Bakery','Deli','Produce','Meat & Seafood','Grocery','Health & Wellness','Pharmacy'
  )),
  status                  text        NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN (
                            'in_progress','formalized','confirmed','substituted',
                            'declined','delivered','cancelled'
                          )),
  requested_by            uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to             uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at            timestamptz,
  bm_resolved_by          uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  bm_resolved_at          timestamptz,
  substituted_product_id  uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  substitution_note       text        NOT NULL DEFAULT '',
  decline_reason          text        NOT NULL DEFAULT '',
  delivered_at            timestamptz,
  delivered_by            uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_requests_status
  ON public.product_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_requests_campaign
  ON public.product_requests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_assigned
  ON public.product_requests(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_product_requests_requested_by
  ON public.product_requests(requested_by, status);
CREATE INDEX IF NOT EXISTS idx_product_requests_lob
  ON public.product_requests(line_of_business);

-- --- PR###### sequence (mirrors WF number convention, no dash) ---
CREATE SEQUENCE IF NOT EXISTS product_request_number_seq START WITH 100001;

CREATE OR REPLACE FUNCTION public.assign_product_request_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := 'PR' || nextval('product_request_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_requests_assign_number ON public.product_requests;
CREATE TRIGGER product_requests_assign_number
  BEFORE INSERT ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_product_request_number();

-- --- updated_at auto-touch ---
CREATE OR REPLACE FUNCTION public.touch_product_request_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_requests_touch ON public.product_requests;
CREATE TRIGGER product_requests_touch
  BEFORE UPDATE ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_request_updated_at();

-- ------------------------------------------------------------
-- product_request_events (audit / comments stream)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_request_events (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_request_id uuid        NOT NULL REFERENCES public.product_requests(id) ON DELETE CASCADE,
  actor_id           uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  from_status        text,
  to_status          text,
  comment            text        NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_request_events_pr
  ON public.product_request_events(product_request_id, created_at DESC);

-- ------------------------------------------------------------
-- RLS — open read to the portal's internal roles, write gated.
-- ------------------------------------------------------------
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_requests_read" ON public.product_requests;
CREATE POLICY "product_requests_read" ON public.product_requests FOR SELECT
  USING (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
    ])
  );

DROP POLICY IF EXISTS "product_requests_insert" ON public.product_requests;
CREATE POLICY "product_requests_insert" ON public.product_requests FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Brand Marketing Manager'
    ])
    AND requested_by = auth.uid()
  );

-- Update: producer on their own draft; BMM/Admin on anything in the
-- chain; Studio/Producer/BMM/Admin can mark delivered.
DROP POLICY IF EXISTS "product_requests_update" ON public.product_requests;
CREATE POLICY "product_requests_update" ON public.product_requests FOR UPDATE
  USING (
    requested_by = auth.uid()
    OR public.current_user_has_role(ARRAY[
      'Admin','Brand Marketing Manager','Studio','Post Producer'
    ])
  )
  WITH CHECK (
    requested_by = auth.uid()
    OR public.current_user_has_role(ARRAY[
      'Admin','Brand Marketing Manager','Studio','Post Producer'
    ])
  );

DROP POLICY IF EXISTS "product_request_events_read" ON public.product_request_events;
CREATE POLICY "product_request_events_read" ON public.product_request_events FOR SELECT
  USING (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
    ])
  );

DROP POLICY IF EXISTS "product_request_events_insert" ON public.product_request_events;
CREATE POLICY "product_request_events_insert" ON public.product_request_events FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
    ])
    AND actor_id = auth.uid()
  );

NOTIFY pgrst, 'reload schema';
