-- ─── Payment Batches ───

CREATE TYPE payment_batch_status AS ENUM ('Draft', 'Sent', 'Confirmed');

CREATE TABLE public.payment_batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  status payment_batch_status NOT NULL DEFAULT 'Draft',
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.users(id),
  sent_at timestamptz,
  confirmed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.payment_batch_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.payment_batches(id) ON DELETE CASCADE,
  crew_payment_id uuid NOT NULL REFERENCES public.crew_payments(id),
  amount numeric(12, 2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(crew_payment_id)  -- one payment per batch slot
);

CREATE TRIGGER payment_batches_updated_at
  BEFORE UPDATE ON public.payment_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_batch_items ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access batches" ON public.payment_batches
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

CREATE POLICY "Admin full access batch items" ON public.payment_batch_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

-- Producer read
CREATE POLICY "Producer read batches" ON public.payment_batches
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Producer'));

CREATE POLICY "Producer read batch items" ON public.payment_batch_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Producer'));

-- ─── Onboarding Checklists ───

CREATE TABLE public.onboarding_checklists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_date date,
  expires_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(vendor_id, item_name)
);

CREATE TRIGGER onboarding_checklists_updated_at
  BEFORE UPDATE ON public.onboarding_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access onboarding" ON public.onboarding_checklists
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin'));

-- Producer read + update
CREATE POLICY "Producer read onboarding" ON public.onboarding_checklists
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Producer'));

CREATE POLICY "Producer update onboarding" ON public.onboarding_checklists
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Producer'));

-- Indexes
CREATE INDEX payment_batch_items_batch_id_idx ON public.payment_batch_items(batch_id);
CREATE INDEX payment_batch_items_crew_payment_id_idx ON public.payment_batch_items(crew_payment_id);
CREATE INDEX onboarding_checklists_vendor_id_idx ON public.onboarding_checklists(vendor_id);
