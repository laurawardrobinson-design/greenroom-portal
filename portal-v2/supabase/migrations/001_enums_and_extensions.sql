-- ============================================================
-- Migration 001: Enums and Extensions
-- Creative Production Portal V2
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- needed for exclusion constraints on date ranges

-- ============================================================
-- Enum types
-- ============================================================

CREATE TYPE user_role AS ENUM ('Admin', 'Producer', 'Studio', 'Vendor');

CREATE TYPE campaign_status AS ENUM (
  'Planning', 'Upcoming', 'In Production', 'Post', 'Complete', 'Cancelled'
);

CREATE TYPE campaign_vendor_status AS ENUM (
  'Invited',
  'Estimate Submitted',
  'Estimate Approved',
  'PO Uploaded',
  'PO Signed',
  'Shoot Complete',
  'Invoice Submitted',
  'Invoice Pre-Approved',
  'Invoice Approved',
  'Paid',
  'Rejected'
);

CREATE TYPE cost_category AS ENUM (
  'Talent', 'Styling', 'Equipment Rental', 'Studio Space',
  'Post-Production', 'Travel', 'Catering', 'Props',
  'Wardrobe', 'Set Design', 'Other'
);

CREATE TYPE asset_category AS ENUM (
  'Shot List', 'Concept Deck', 'Reference', 'Product Info',
  'Contract', 'Estimate', 'PO', 'Invoice',
  'Insurance', 'Legal', 'Deliverable', 'Other'
);

CREATE TYPE gear_status AS ENUM (
  'Available', 'Reserved', 'Checked Out',
  'Under Maintenance', 'In Repair', 'Retired'
);

CREATE TYPE gear_condition AS ENUM (
  'Excellent', 'Good', 'Fair', 'Poor', 'Damaged'
);

CREATE TYPE gear_category AS ENUM (
  'Camera', 'Lens', 'Lighting', 'Audio',
  'Tripod / Support', 'Grip', 'Accessories', 'Other'
);

CREATE TYPE budget_request_status AS ENUM ('Pending', 'Approved', 'Declined');

CREATE TYPE reservation_status AS ENUM ('Confirmed', 'Cancelled', 'Checked Out', 'Completed');

CREATE TYPE maintenance_type AS ENUM ('Scheduled', 'Repair');

CREATE TYPE maintenance_status AS ENUM (
  'Scheduled', 'In Progress', 'Sent for Repair', 'Completed', 'Cancelled'
);

CREATE TYPE invoice_parse_status AS ENUM ('pending', 'processing', 'completed', 'failed');
