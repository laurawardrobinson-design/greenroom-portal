-- ============================================================
-- Migration 003: Vendor & Financial Tables
-- vendors, campaign_vendors, vendor_estimate_items,
-- vendor_invoices, vendor_invoice_items, budget_requests
-- ============================================================

-- Vendors (approved roster of external contractors)
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  tax_id text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  onboarded_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from users to vendors (deferred from 002)
ALTER TABLE public.users
  ADD CONSTRAINT users_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- Add FK from campaign_assets to vendors (deferred from 002)
ALTER TABLE public.campaign_assets
  ADD CONSTRAINT campaign_assets_vendor_id_fkey
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- Campaign Vendors (PO lifecycle — the 10-step state machine)
CREATE TABLE public.campaign_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status campaign_vendor_status NOT NULL DEFAULT 'Invited',
  invited_at timestamptz NOT NULL DEFAULT now(),
  estimate_total numeric NOT NULL DEFAULT 0,
  po_file_url text,
  po_signed_at timestamptz,
  signature_url text,
  signed_ip text,
  signature_name text,
  signature_timestamp timestamptz,
  invoice_total numeric NOT NULL DEFAULT 0,
  payment_amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, vendor_id)
);

-- Vendor Estimate Items (itemized line items)
CREATE TABLE public.vendor_estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_vendor_id uuid NOT NULL REFERENCES campaign_vendors(id) ON DELETE CASCADE,
  category cost_category NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vendor Invoices (uploaded PDFs, AI-parsed data, approval tracking)
CREATE TABLE public.vendor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_vendor_id uuid NOT NULL REFERENCES campaign_vendors(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  parsed_data jsonb,
  auto_flags jsonb,
  parse_status invoice_parse_status NOT NULL DEFAULT 'pending',
  parsed_at timestamptz,
  producer_approved_at timestamptz,
  producer_approved_by uuid REFERENCES users(id),
  hop_approved_at timestamptz,
  hop_approved_by uuid REFERENCES users(id),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Vendor Invoice Items (parsed from PDF, editable for corrections)
CREATE TABLE public.vendor_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES vendor_invoices(id) ON DELETE CASCADE,
  category cost_category NOT NULL,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  matched_estimate_item_id uuid REFERENCES vendor_estimate_items(id),
  flagged boolean NOT NULL DEFAULT false,
  flag_reason text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Budget Requests (overage requests from Producer, approved by HOP)
CREATE TABLE public.budget_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id),
  amount numeric NOT NULL DEFAULT 0,
  rationale text NOT NULL DEFAULT '',
  status budget_request_status NOT NULL DEFAULT 'Pending',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  review_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
