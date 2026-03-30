-- Add vendor assignment to campaign deliverables
ALTER TABLE public.campaign_deliverables
  ADD COLUMN IF NOT EXISTS assigned_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Index for lookups by vendor
CREATE INDEX IF NOT EXISTS idx_campaign_deliverables_vendor
  ON public.campaign_deliverables (assigned_vendor_id)
  WHERE assigned_vendor_id IS NOT NULL;
