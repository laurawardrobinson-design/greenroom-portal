-- ============================================================
-- Migration 005: Triggers and Functions
-- updated_at auto-trigger, state machine enforcement,
-- atomic gear checkout/checkin, budget calculations
-- ============================================================

-- ============================================================
-- 1. Auto-update updated_at on all timestamped tables
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'budget_pools', 'campaigns', 'vendors',
    'campaign_vendors', 'vendor_invoices', 'budget_requests',
    'gear_items', 'gear_reservations', 'gear_maintenance'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 2. Vendor PO Lifecycle State Machine
-- Prevents invalid status transitions at the DB level
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_campaign_vendor_transition()
RETURNS trigger AS $$
DECLARE
  allowed text[];
BEGIN
  -- Only check when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE OLD.status::text
    WHEN 'Invited'            THEN allowed := ARRAY['Estimate Submitted', 'Rejected'];
    WHEN 'Estimate Submitted' THEN allowed := ARRAY['Estimate Approved', 'Rejected'];
    WHEN 'Estimate Approved'  THEN allowed := ARRAY['PO Uploaded', 'Rejected'];
    WHEN 'PO Uploaded'        THEN allowed := ARRAY['PO Signed', 'Rejected'];
    WHEN 'PO Signed'          THEN allowed := ARRAY['Shoot Complete', 'Rejected'];
    WHEN 'Shoot Complete'     THEN allowed := ARRAY['Invoice Submitted'];
    WHEN 'Invoice Submitted'  THEN allowed := ARRAY['Invoice Pre-Approved', 'Rejected'];
    WHEN 'Invoice Pre-Approved' THEN allowed := ARRAY['Invoice Approved', 'Rejected'];
    WHEN 'Invoice Approved'   THEN allowed := ARRAY['Paid'];
    WHEN 'Paid'               THEN allowed := ARRAY[]::text[];
    WHEN 'Rejected'           THEN allowed := ARRAY['Invited'];
    ELSE allowed := ARRAY[]::text[];
  END CASE;

  IF NOT (NEW.status::text = ANY(allowed)) THEN
    RAISE EXCEPTION 'Invalid vendor status transition from "%" to "%"',
      OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_cv_transition
  BEFORE UPDATE ON public.campaign_vendors
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.enforce_campaign_vendor_transition();

-- ============================================================
-- 3. Atomic Gear Checkout (prevents race conditions)
-- ============================================================

CREATE OR REPLACE FUNCTION public.atomic_checkout(
  p_gear_item_id uuid,
  p_user_id uuid,
  p_campaign_id uuid DEFAULT NULL,
  p_condition gear_condition DEFAULT 'Good',
  p_notes text DEFAULT ''
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
  INSERT INTO gear_checkouts (gear_item_id, user_id, campaign_id, condition_out, notes)
  VALUES (p_gear_item_id, p_user_id, p_campaign_id, p_condition, p_notes)
  RETURNING id INTO v_checkout_id;

  -- Update gear status
  UPDATE gear_items SET status = 'Checked Out' WHERE id = p_gear_item_id;

  RETURN v_checkout_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Atomic Gear Checkin
-- ============================================================

CREATE OR REPLACE FUNCTION public.atomic_checkin(
  p_checkout_id uuid,
  p_condition gear_condition DEFAULT 'Good',
  p_notes text DEFAULT ''
)
RETURNS void AS $$
DECLARE
  v_gear_item_id uuid;
BEGIN
  -- Get and lock the checkout
  SELECT gear_item_id INTO v_gear_item_id
  FROM gear_checkouts
  WHERE id = p_checkout_id AND checked_in_at IS NULL
  FOR UPDATE;

  IF v_gear_item_id IS NULL THEN
    RAISE EXCEPTION 'Checkout not found or already checked in';
  END IF;

  -- Close the checkout
  UPDATE gear_checkouts
  SET checked_in_at = now(),
      condition_in = p_condition,
      notes = CASE WHEN p_notes != '' THEN p_notes ELSE notes END
  WHERE id = p_checkout_id;

  -- Update gear status back to Available
  UPDATE gear_items SET
    status = 'Available',
    condition = p_condition
  WHERE id = v_gear_item_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Budget Pool Remaining Calculation
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_pool_remaining(p_pool_id uuid)
RETURNS numeric AS $$
  SELECT bp.total_amount - COALESCE(SUM(c.production_budget), 0)
  FROM budget_pools bp
  LEFT JOIN campaigns c ON c.budget_pool_id = bp.id
  WHERE bp.id = p_pool_id
  GROUP BY bp.total_amount;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 6. Campaign Financial Summary
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_campaign_financials(p_campaign_id uuid)
RETURNS TABLE(committed numeric, spent numeric) AS $$
  SELECT
    COALESCE(SUM(cv.estimate_total) FILTER (
      WHERE cv.status NOT IN ('Invited', 'Rejected')
    ), 0) AS committed,
    COALESCE(SUM(cv.payment_amount) FILTER (
      WHERE cv.status = 'Paid'
    ), 0) AS spent
  FROM campaign_vendors cv
  WHERE cv.campaign_id = p_campaign_id;
$$ LANGUAGE sql STABLE;
