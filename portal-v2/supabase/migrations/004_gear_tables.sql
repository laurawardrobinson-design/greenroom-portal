-- ============================================================
-- Migration 004: Gear / Inventory Tables
-- gear_items, gear_checkouts, gear_reservations,
-- gear_kits, gear_kit_items, gear_maintenance
-- ============================================================

-- Gear Items
CREATE TABLE public.gear_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category gear_category NOT NULL DEFAULT 'Other',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  qr_code text NOT NULL DEFAULT '' UNIQUE,
  status gear_status NOT NULL DEFAULT 'Available',
  condition gear_condition NOT NULL DEFAULT 'Good',
  purchase_date date,
  purchase_price numeric NOT NULL DEFAULT 0,
  warranty_expiry date,
  image_url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Gear Checkouts (check-out / check-in tracking with condition)
CREATE TABLE public.gear_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid NOT NULL REFERENCES gear_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  condition_out gear_condition NOT NULL DEFAULT 'Good',
  condition_in gear_condition,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one open checkout per gear item at a time
CREATE UNIQUE INDEX gear_checkouts_one_open_per_item
  ON gear_checkouts (gear_item_id)
  WHERE checked_in_at IS NULL;

-- Gear Reservations (date-based with overlap prevention)
CREATE TABLE public.gear_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid NOT NULL REFERENCES gear_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status reservation_status NOT NULL DEFAULT 'Confirmed',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Prevent overlapping reservations for the same item
  EXCLUDE USING gist (
    gear_item_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status = 'Confirmed')
);

-- Gear Kits (favorite bundles)
CREATE TABLE public.gear_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id),
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gear Kit Items (bridge table)
CREATE TABLE public.gear_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id uuid NOT NULL REFERENCES gear_kits(id) ON DELETE CASCADE,
  gear_item_id uuid NOT NULL REFERENCES gear_items(id) ON DELETE CASCADE,
  UNIQUE(kit_id, gear_item_id)
);

-- Gear Maintenance
CREATE TABLE public.gear_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gear_item_id uuid NOT NULL REFERENCES gear_items(id) ON DELETE CASCADE,
  type maintenance_type NOT NULL DEFAULT 'Scheduled',
  status maintenance_status NOT NULL DEFAULT 'Scheduled',
  description text NOT NULL DEFAULT '',
  cost numeric NOT NULL DEFAULT 0,
  performed_by uuid REFERENCES users(id),
  scheduled_date date,
  completed_date date,
  next_due_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
