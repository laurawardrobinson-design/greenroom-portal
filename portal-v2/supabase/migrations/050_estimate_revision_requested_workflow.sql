-- ============================================================
-- Migration 050: Estimate Revision Requested Workflow
-- Adds explicit estimate revision state and feedback metadata.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'campaign_vendor_status'
      AND e.enumlabel = 'Estimate Revision Requested'
  ) THEN
    ALTER TYPE public.campaign_vendor_status
      ADD VALUE 'Estimate Revision Requested' AFTER 'Estimate Submitted';
  END IF;
END $$;

ALTER TABLE public.campaign_vendors
  ADD COLUMN IF NOT EXISTS estimate_feedback text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estimate_feedback_at timestamptz;

-- Keep DB-level transition enforcement in sync with app-level state machine.
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
    WHEN 'Estimate Submitted' THEN allowed := ARRAY['Estimate Approved', 'Estimate Revision Requested', 'Rejected'];
    WHEN 'Estimate Revision Requested' THEN allowed := ARRAY['Estimate Submitted', 'Rejected'];
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
