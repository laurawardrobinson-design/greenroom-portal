-- Crew payment status enum
CREATE TYPE crew_payment_status AS ENUM (
  'Pending Approval',
  'Approved',
  'Sent to Paymaster',
  'Paid'
);

-- Crew payments table — created when Producer submits confirmed days for payment
CREATE TABLE public.crew_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.crew_bookings(id) ON DELETE CASCADE,
  total_days integer NOT NULL,
  total_amount numeric(12, 2) NOT NULL,
  status crew_payment_status NOT NULL DEFAULT 'Pending Approval',
  notes text NOT NULL DEFAULT '',
  confirmed_by uuid REFERENCES public.users(id),
  confirmed_at timestamptz DEFAULT now(),
  approved_by uuid REFERENCES public.users(id),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- One payment per booking
CREATE UNIQUE INDEX crew_payments_booking_id_unique ON public.crew_payments(booking_id);

-- Updated_at trigger
CREATE TRIGGER crew_payments_updated_at
  BEFORE UPDATE ON public.crew_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.crew_payments ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admin full access" ON public.crew_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin')
  );

-- Producer: read all, insert (submit)
CREATE POLICY "Producer read crew payments" ON public.crew_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Producer')
  );

CREATE POLICY "Producer insert crew payments" ON public.crew_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Producer')
  );

-- Studio: read only
CREATE POLICY "Studio read crew payments" ON public.crew_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Studio')
  );
