-- ============================================================
-- Migration 051: Add due_date to gear_checkouts
-- Tracks when a checked-out item is expected to be returned.
-- Also updates atomic_checkout RPC to accept the new parameter.
-- ============================================================

ALTER TABLE public.gear_checkouts
  ADD COLUMN IF NOT EXISTS due_date date;

-- Update atomic_checkout to accept an optional due_date
CREATE OR REPLACE FUNCTION public.atomic_checkout(
  p_gear_item_id uuid,
  p_user_id uuid,
  p_campaign_id uuid DEFAULT NULL,
  p_condition gear_condition DEFAULT 'Good',
  p_notes text DEFAULT '',
  p_due_date date DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_checkout_id uuid;
  v_current_status gear_status;
BEGIN
  -- Lock the row to prevent concurrent checkouts
  SELECT status INTO v_current_status
  FROM gear_items
  WHERE id = p_gear_item_id
  FOR UPDATE;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Gear item not found';
  END IF;

  IF v_current_status != 'Available' AND v_current_status != 'Reserved' THEN
    RAISE EXCEPTION 'Gear item is not available (current status: %)', v_current_status;
  END IF;

  -- Create checkout record
  INSERT INTO gear_checkouts (gear_item_id, user_id, campaign_id, condition_out, notes, due_date)
  VALUES (p_gear_item_id, p_user_id, p_campaign_id, p_condition, p_notes, p_due_date)
  RETURNING id INTO v_checkout_id;

  -- Update gear status
  UPDATE gear_items SET status = 'Checked Out' WHERE id = p_gear_item_id;

  RETURN v_checkout_id;
END;
$$ LANGUAGE plpgsql;
