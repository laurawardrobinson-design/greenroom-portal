-- ============================================================
-- 085: Product Requests v2 — Document-oriented redesign
-- ============================================================
--
-- Replaces the flat item-per-row model (084) with a three-level
-- hierarchy that mirrors the physical Excel process:
--
--   product_request_docs          ← one document per campaign + shoot date
--     product_request_dept_sections  ← one section per department
--       product_request_items        ← one row per product in that section
--
-- Also adds `role` (hero / secondary) to campaign_products so BMMs
-- can designate product strategy at the campaign level.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Clean up v1 tables (no production data yet)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.product_request_events CASCADE;
DROP TABLE IF EXISTS public.product_requests CASCADE;
DROP SEQUENCE IF EXISTS product_request_number_seq;
DROP FUNCTION IF EXISTS public.assign_product_request_number() CASCADE;
DROP FUNCTION IF EXISTS public.touch_product_request_updated_at() CASCADE;

-- ------------------------------------------------------------
-- 2. Hero / Secondary designation on campaign_products
-- ------------------------------------------------------------
ALTER TABLE public.campaign_products
  ADD COLUMN IF NOT EXISTS role text
  CHECK (role IS NULL OR role IN ('hero', 'secondary'));

-- ------------------------------------------------------------
-- 3. Document table (one per campaign × shoot date)
-- ------------------------------------------------------------
CREATE TABLE public.product_request_docs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number      text        NOT NULL UNIQUE,
  campaign_id     uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  shoot_date      date        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','submitted','forwarded','fulfilled','cancelled')),
  submitted_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at    timestamptz,
  forwarded_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  forwarded_at    timestamptz,
  fulfilled_at    timestamptz,
  notes           text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_docs_campaign    ON public.product_request_docs(campaign_id);
CREATE INDEX idx_pr_docs_status      ON public.product_request_docs(status, shoot_date DESC);
CREATE INDEX idx_pr_docs_submitted   ON public.product_request_docs(submitted_by);
CREATE UNIQUE INDEX idx_pr_docs_campaign_date
  ON public.product_request_docs(campaign_id, shoot_date)
  WHERE status <> 'cancelled';

-- PR###### sequence (same convention as WF numbers — no dash)
CREATE SEQUENCE product_request_number_seq START WITH 100001;

CREATE OR REPLACE FUNCTION public.assign_pr_doc_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.doc_number IS NULL OR NEW.doc_number = '' THEN
    NEW.doc_number := 'PR' || nextval('product_request_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pr_docs_assign_number
  BEFORE INSERT ON public.product_request_docs
  FOR EACH ROW EXECUTE FUNCTION public.assign_pr_doc_number();

CREATE OR REPLACE FUNCTION public.touch_pr_doc_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pr_docs_touch
  BEFORE UPDATE ON public.product_request_docs
  FOR EACH ROW EXECUTE FUNCTION public.touch_pr_doc_updated_at();

-- ------------------------------------------------------------
-- 4. Department sections (one per dept within a doc)
-- ------------------------------------------------------------
CREATE TABLE public.product_request_dept_sections (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id          uuid        NOT NULL REFERENCES public.product_request_docs(id) ON DELETE CASCADE,
  department      text        NOT NULL
                  CHECK (department IN ('Bakery','Produce','Deli','Meat-Seafood','Grocery')),
  date_needed     date,
  time_needed     text        NOT NULL DEFAULT '',
  pickup_person   text        NOT NULL DEFAULT '',
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, department)
);

CREATE INDEX idx_pr_sections_doc ON public.product_request_dept_sections(doc_id);

-- ------------------------------------------------------------
-- 5. Line items (one per product within a section)
-- ------------------------------------------------------------
CREATE TABLE public.product_request_items (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id           uuid        NOT NULL REFERENCES public.product_request_dept_sections(id) ON DELETE CASCADE,
  product_id           uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  quantity             numeric     NOT NULL DEFAULT 1,
  size                 text        NOT NULL DEFAULT '',
  special_instructions text        NOT NULL DEFAULT '',
  from_shot_list       boolean     NOT NULL DEFAULT false,
  sort_order           integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_items_section    ON public.product_request_items(section_id);
CREATE INDEX idx_pr_items_product    ON public.product_request_items(product_id);
CREATE INDEX idx_pr_items_shot_list  ON public.product_request_items(from_shot_list) WHERE from_shot_list = true;

CREATE OR REPLACE FUNCTION public.touch_pr_item_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pr_items_touch
  BEFORE UPDATE ON public.product_request_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_pr_item_updated_at();

-- ------------------------------------------------------------
-- 6. Events / audit log
-- ------------------------------------------------------------
CREATE TABLE public.product_request_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      uuid        NOT NULL REFERENCES public.product_request_docs(id) ON DELETE CASCADE,
  actor_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  from_status text,
  to_status   text,
  comment     text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_events_doc ON public.product_request_events(doc_id, created_at DESC);

-- ------------------------------------------------------------
-- 7. RLS
-- ------------------------------------------------------------
ALTER TABLE public.product_request_docs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_request_dept_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_request_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_request_events        ENABLE ROW LEVEL SECURITY;

-- Docs: read for all portal roles
CREATE POLICY "pr_docs_read" ON public.product_request_docs FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
  ]));

-- Docs: insert for producers / admins / post-producers
CREATE POLICY "pr_docs_insert" ON public.product_request_docs FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY['Admin','Producer','Post Producer'])
    AND submitted_by = auth.uid()
  );

-- Docs: update — author on drafts; BMM/Admin/Studio for downstream transitions
CREATE POLICY "pr_docs_update" ON public.product_request_docs FOR UPDATE
  USING (
    submitted_by = auth.uid()
    OR public.current_user_has_role(ARRAY['Admin','Brand Marketing Manager','Studio'])
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR public.current_user_has_role(ARRAY['Admin','Brand Marketing Manager','Studio'])
  );

-- Sections: inherit doc visibility
CREATE POLICY "pr_sections_read" ON public.product_request_dept_sections FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
  ]));

CREATE POLICY "pr_sections_write" ON public.product_request_dept_sections FOR ALL
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager'
  ]))
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager'
  ]));

-- Items: same
CREATE POLICY "pr_items_read" ON public.product_request_items FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
  ]));

CREATE POLICY "pr_items_write" ON public.product_request_items FOR ALL
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager'
  ]))
  WITH CHECK (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager'
  ]));

-- Events: read all portal roles, insert any portal role
CREATE POLICY "pr_events_read" ON public.product_request_events FOR SELECT
  USING (public.current_user_has_role(ARRAY[
    'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
  ]));

CREATE POLICY "pr_events_insert" ON public.product_request_events FOR INSERT
  WITH CHECK (
    public.current_user_has_role(ARRAY[
      'Admin','Producer','Post Producer','Brand Marketing Manager','Studio'
    ])
    AND actor_id = auth.uid()
  );

NOTIFY pgrst, 'reload schema';
