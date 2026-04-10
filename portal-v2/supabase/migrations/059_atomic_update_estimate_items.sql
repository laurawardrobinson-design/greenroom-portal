-- Atomic estimate items replacement
-- Wraps delete + insert in a single transaction to prevent data loss on insert failure.

CREATE OR REPLACE FUNCTION public.update_estimate_items(
  p_campaign_vendor_id uuid,
  p_items jsonb
)
RETURNS void AS $$
DECLARE
  v_total numeric;
BEGIN
  -- Delete existing items
  DELETE FROM public.vendor_estimate_items
  WHERE campaign_vendor_id = p_campaign_vendor_id;

  -- Insert new items (no-op if array is empty)
  INSERT INTO public.vendor_estimate_items
    (campaign_vendor_id, category, description, quantity, unit_price, amount, sort_order)
  SELECT
    p_campaign_vendor_id,
    (item->>'category'),
    (item->>'description'),
    COALESCE((item->>'quantity')::int, 1),
    (item->>'unit_price')::numeric,
    (item->>'amount')::numeric,
    (item->>'sort_order')::int
  FROM jsonb_array_elements(p_items) AS item;

  -- Sync estimate_total on the parent row
  SELECT COALESCE(SUM((item->>'amount')::numeric), 0)
  INTO v_total
  FROM jsonb_array_elements(p_items) AS item;

  UPDATE public.campaign_vendors
  SET estimate_total = v_total
  WHERE id = p_campaign_vendor_id;
END;
$$ LANGUAGE plpgsql;
