-- ============================================================
-- Migration 036: Crew Bookings & Rate Cards
-- Simplified crew track: Book → Work → Confirm → Approve → Pay
-- ============================================================

-- ============================================================
-- New enums
-- ============================================================

CREATE TYPE crew_booking_status AS ENUM (
  'Draft',
  'Pending Approval',
  'Confirmed',
  'Completed',
  'Cancelled'
);

CREATE TYPE classification_type AS ENUM (
  '1099',
  'W2 Paymaster',
  'Loan Out'
);

-- ============================================================
-- Rate Cards — standard day rates by role
-- ============================================================

CREATE TABLE public.rate_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role        text NOT NULL,
  day_rate    numeric(12,2) NOT NULL,
  notes       text NOT NULL DEFAULT '',
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed common production roles
INSERT INTO public.rate_cards (role, day_rate) VALUES
  ('Photographer', 800),
  ('Food Stylist', 650),
  ('Prop Stylist', 550),
  ('Production Assistant', 350),
  ('Digital Tech', 600),
  ('Gaffer', 500),
  ('Grip', 450),
  ('Wardrobe Stylist', 550),
  ('Hair & Makeup', 500),
  ('Set Designer', 600),
  ('Art Director (Freelance)', 750),
  ('Producer (Freelance)', 700),
  ('Editor', 600),
  ('Retoucher', 550);

-- ============================================================
-- Crew Bookings — who's working on a campaign, at what rate
-- ============================================================

CREATE TABLE public.crew_bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  -- Can reference either a vendor (external crew) or a user (internal)
  vendor_id           uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  user_id             uuid REFERENCES public.users(id) ON DELETE SET NULL,
  role                text NOT NULL,
  day_rate            numeric(12,2) NOT NULL,
  classification      classification_type NOT NULL DEFAULT '1099',
  status              crew_booking_status NOT NULL DEFAULT 'Draft',
  booked_by           uuid NOT NULL REFERENCES public.users(id),
  approved_by         uuid REFERENCES public.users(id),
  approved_at         timestamptz,
  notes               text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Must reference at least one person
  CONSTRAINT crew_booking_has_person CHECK (vendor_id IS NOT NULL OR user_id IS NOT NULL)
);

-- ============================================================
-- Crew Booking Dates — which shoot days this person is booked for
-- ============================================================

CREATE TABLE public.crew_booking_dates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES public.crew_bookings(id) ON DELETE CASCADE,
  shoot_date      date NOT NULL,
  -- confirmed = NULL means not yet confirmed, true = worked, false = cancelled/no-show
  confirmed       boolean,
  confirmed_by    uuid REFERENCES public.users(id),
  confirmed_at    timestamptz,
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Prevent booking same person on same date twice for same campaign
CREATE UNIQUE INDEX crew_booking_dates_unique
  ON public.crew_booking_dates (booking_id, shoot_date);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_crew_bookings_campaign ON public.crew_bookings(campaign_id);
CREATE INDEX idx_crew_bookings_vendor ON public.crew_bookings(vendor_id);
CREATE INDEX idx_crew_bookings_user ON public.crew_bookings(user_id);
CREATE INDEX idx_crew_bookings_status ON public.crew_bookings(status);
CREATE INDEX idx_crew_booking_dates_booking ON public.crew_booking_dates(booking_id);
CREATE INDEX idx_rate_cards_role ON public.rate_cards(role);

-- ============================================================
-- Auto-update timestamps
-- ============================================================

CREATE TRIGGER set_updated_at_crew_bookings
  BEFORE UPDATE ON public.crew_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_rate_cards
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.crew_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_booking_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

-- Rate cards: Admin/Producer can read, Admin can modify
CREATE POLICY "rate_cards_select" ON public.rate_cards FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "rate_cards_admin" ON public.rate_cards FOR ALL
  USING (get_my_role() = 'Admin');

-- Crew bookings: Admin/Producer see all, Studio sees own bookings
CREATE POLICY "crew_bookings_admin_producer" ON public.crew_bookings FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "crew_bookings_studio_own" ON public.crew_bookings FOR SELECT
  USING (
    get_my_role() = 'Studio'
    AND user_id = auth.uid()
  );

CREATE POLICY "crew_bookings_vendor_own" ON public.crew_bookings FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND vendor_id = get_my_vendor_id()
  );

CREATE POLICY "crew_bookings_modify" ON public.crew_bookings FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));

-- Crew booking dates: follow parent booking access
CREATE POLICY "crew_booking_dates_admin_producer" ON public.crew_booking_dates FOR SELECT
  USING (get_my_role() IN ('Admin', 'Producer'));

CREATE POLICY "crew_booking_dates_studio_own" ON public.crew_booking_dates FOR SELECT
  USING (
    get_my_role() = 'Studio'
    AND booking_id IN (
      SELECT id FROM public.crew_bookings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "crew_booking_dates_vendor_own" ON public.crew_booking_dates FOR SELECT
  USING (
    get_my_role() = 'Vendor'
    AND booking_id IN (
      SELECT id FROM public.crew_bookings WHERE vendor_id = get_my_vendor_id()
    )
  );

CREATE POLICY "crew_booking_dates_modify" ON public.crew_booking_dates FOR ALL
  USING (get_my_role() IN ('Admin', 'Producer'));
