-- ============================================================
-- 067: Post Workflow — Edit Rooms & Hard Drive Management
-- ============================================================

-- Enable btree_gist for EXCLUDE constraint on edit_room_reservations
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- EDIT ROOMS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edit_rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  notes      text,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed 6 rooms
INSERT INTO edit_rooms (name, sort_order) VALUES
  ('Edit Suite 1', 1),
  ('Edit Suite 2', 2),
  ('Edit Suite 3', 3),
  ('Edit Suite 4', 4),
  ('Color Bay',    5),
  ('Sound Bay',    6);

-- ------------------------------------------------------------
-- EDIT ROOM RESERVATIONS
-- One record per room per day (mirrors studio space_reservations pattern).
-- group_id links consecutive days of the same booking for display.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edit_room_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid REFERENCES edit_rooms(id) ON DELETE CASCADE NOT NULL,
  campaign_id     uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  editor_name     text NOT NULL,
  editor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  reserved_date   date NOT NULL,
  group_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  status          text NOT NULL DEFAULT 'confirmed',
  notes           text,
  reserved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, reserved_date),
  CONSTRAINT edit_room_reservation_status_check
    CHECK (status IN ('confirmed', 'cancelled', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_edit_room_reservations_room_date
  ON edit_room_reservations (room_id, reserved_date);

CREATE INDEX IF NOT EXISTS idx_edit_room_reservations_campaign
  ON edit_room_reservations (campaign_id);

CREATE INDEX IF NOT EXISTS idx_edit_room_reservations_group
  ON edit_room_reservations (group_id);

CREATE TRIGGER set_edit_room_reservations_updated_at
  BEFORE UPDATE ON edit_room_reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- MEDIA DRIVES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media_drives (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand                   text NOT NULL,
  model                   text,
  storage_size            text NOT NULL,
  drive_type              text NOT NULL,
  purchase_date           date,
  retirement_date         date,
  condition               text NOT NULL DEFAULT 'Good',
  status                  text NOT NULL DEFAULT 'Available',
  location                text NOT NULL DEFAULT 'Corporate',
  assigned_to_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  is_permanently_assigned boolean NOT NULL DEFAULT false,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_drive_condition_check
    CHECK (condition IN ('Good', 'Fair', 'Poor', 'Damaged')),
  CONSTRAINT media_drive_status_check
    CHECK (status IN ('Available', 'Reserved', 'Checked Out', 'Pending Backup/Wipe', 'Retired')),
  CONSTRAINT media_drive_location_check
    CHECK (location IN ('Corporate', 'With Editor', 'On Set', 'Other'))
);

CREATE INDEX IF NOT EXISTS idx_media_drives_status   ON media_drives (status);
CREATE INDEX IF NOT EXISTS idx_media_drives_size     ON media_drives (storage_size);
CREATE INDEX IF NOT EXISTS idx_media_drives_assigned ON media_drives (assigned_to_user_id);

-- Auto-compute retirement_date = purchase_date + 3 years
CREATE OR REPLACE FUNCTION set_drive_retirement_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.purchase_date IS NOT NULL THEN
    NEW.retirement_date := NEW.purchase_date + INTERVAL '3 years';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compute_drive_retirement_date
  BEFORE INSERT OR UPDATE OF purchase_date ON media_drives
  FOR EACH ROW EXECUTE FUNCTION set_drive_retirement_date();

CREATE TRIGGER set_media_drives_updated_at
  BEFORE UPDATE ON media_drives
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Seed initial drive inventory (from Data Management Log.xlsx)
-- Purchase dates marked UNKNOWN default to Jan 1 of estimated year.
-- Retirement dates are computed by the trigger.
-- ------------------------------------------------------------

INSERT INTO media_drives (brand, model, storage_size, drive_type, purchase_date, condition, status, location, notes) VALUES
  -- WD Elements 8TB HDD — pending backup
  ('WD', 'Elements', '8 TB', 'HDD', '2026-03-19', 'Good', 'Pending Backup/Wipe', 'Corporate', NULL),
  -- Blackbox PRO 12TB HDD — available
  ('Blackbox', 'PRO', '12 TB', 'HDD - Superspeed', '2026-03-19', 'Good', 'Available', 'Corporate', NULL),
  -- Samsung T9 2TB — pending backup (unknown purchase ~04/24)
  ('Samsung', 'T9', '2 TB', 'Portable SSD', '2024-04-01', 'Fair', 'Pending Backup/Wipe', 'Corporate', 'Purchase date unknown — estimated April 2024'),
  -- Toshiba 500GB HDD — will be marked Retired + Damaged below
  ('Toshiba', NULL, '500 GB', 'HDD', NULL, 'Good', 'Retired', 'Corporate', 'Purchase date unknown — produced around 2013'),
  -- WD My Book 16TB HDD (unknown purchase ~01/24)
  ('WD', 'My Book', '16 TB', 'HDD', '2024-01-01', 'Good', 'Available', 'Corporate', 'Purchase date unknown — estimated January 2024'),
  -- Samsung T9 2TB (Jason)
  ('Samsung', 'T9', '2 TB', 'Portable SSD', '2024-04-01', 'Good', 'Available', 'Corporate', 'Purchase date unknown — estimated April 2024'),
  -- Samsung T9 2TB (Courtney)
  ('Samsung', 'T9', '2 TB', 'Portable SSD', '2024-04-01', 'Good', 'Available', 'Corporate', 'Purchase date unknown — estimated April 2024'),
  -- Samsung T9 2TB (Courtney second)
  ('Samsung', 'T9', '2 TB', 'Portable SSD', '2024-04-01', 'Good', 'Available', 'Corporate', 'Purchase date unknown — estimated April 2024'),
  -- Samsung T9 4TB (Kyle 1)
  ('Samsung', 'T9', '4 TB', 'Portable SSD', '2025-11-01', 'Good', 'Available', 'Corporate', NULL),
  -- Samsung T9 4TB (Kyle 2)
  ('Samsung', 'T9', '4 TB', 'Portable SSD', '2025-11-01', 'Good', 'Available', 'Corporate', NULL),
  -- SanDisk Extreme 2TB #1 — past retirement (purchase 2021, retired Jan 2024)
  ('SanDisk', 'Extreme', '2 TB', 'Portable SSD', '2021-01-01', 'Good', 'Available', 'Corporate', 'Purchase date unknown — produced 2021'),
  -- SanDisk Extreme 2TB #2 — past retirement
  ('SanDisk', 'Extreme', '2 TB', 'Portable SSD', '2021-01-01', 'Good', 'Available', 'Corporate', 'Purchase date unknown — produced 2021'),
  -- SanDisk Extreme 4TB — past retirement
  ('SanDisk', 'Extreme', '4 TB', 'Portable SSD', '2021-01-01', 'Good', 'Available', 'Corporate', 'Purchase date unknown — produced 2021'),
  -- Samsung T9 1TB (Nick)
  ('Samsung', 'T9', '1 TB', 'Portable SSD', '2025-12-17', 'Good', 'Available', 'Corporate', NULL),
  -- Samsung T9 2TB (Brittany)
  ('Samsung', 'T9', '2 TB', 'Portable SSD', '2024-02-02', 'Good', 'Available', 'Corporate', NULL);

-- Fix the Toshiba — no purchase date so retirement_date trigger won't fire; mark Damaged/Retired
UPDATE media_drives SET condition = 'Damaged', retirement_date = NULL
  WHERE brand = 'Toshiba' AND storage_size = '500 GB';

-- ------------------------------------------------------------
-- DRIVE CHECKOUT SESSIONS
-- A session pairs two drives (one for shooter, one for media manager) for a shoot.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS drive_checkout_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  project_display_name text,
  shoot_date           date,
  checkout_date        date NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date date,
  checked_out_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'active',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_checkout_session_status_check
    CHECK (status IN ('active', 'pending_backup', 'partial_return', 'completed'))
);

CREATE INDEX IF NOT EXISTS idx_drive_checkout_sessions_campaign
  ON drive_checkout_sessions (campaign_id);

CREATE INDEX IF NOT EXISTS idx_drive_checkout_sessions_status
  ON drive_checkout_sessions (status);

CREATE TRIGGER set_drive_checkout_sessions_updated_at
  BEFORE UPDATE ON drive_checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- DRIVE CHECKOUT ITEMS
-- One row per drive per session (always exactly 2 rows per session).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS drive_checkout_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               uuid REFERENCES drive_checkout_sessions(id) ON DELETE CASCADE NOT NULL,
  drive_id                 uuid REFERENCES media_drives(id) NOT NULL,
  checkout_role            text NOT NULL,
  condition_out            text,
  condition_in             text,
  actual_return_date       date,
  data_offloaded_backed_up boolean NOT NULL DEFAULT false,
  backup_location          text,
  drive_wiped              boolean NOT NULL DEFAULT false,
  clear_for_reuse          boolean NOT NULL DEFAULT false,
  returned_at              timestamptz,
  notes                    text,
  CONSTRAINT drive_checkout_item_role_check
    CHECK (checkout_role IN ('shooter', 'media_manager'))
);

CREATE INDEX IF NOT EXISTS idx_drive_checkout_items_session
  ON drive_checkout_items (session_id);

CREATE INDEX IF NOT EXISTS idx_drive_checkout_items_drive
  ON drive_checkout_items (drive_id);

-- ------------------------------------------------------------
-- DRIVE RESERVATIONS
-- Pre-reserve drives for an upcoming shoot before checkout day.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS drive_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id    uuid REFERENCES media_drives(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  shoot_date  date NOT NULL,
  reserved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'reserved',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drive_reservation_status_check
    CHECK (status IN ('reserved', 'cancelled', 'converted_to_checkout'))
);

CREATE INDEX IF NOT EXISTS idx_drive_reservations_drive
  ON drive_reservations (drive_id);

CREATE INDEX IF NOT EXISTS idx_drive_reservations_campaign
  ON drive_reservations (campaign_id);

-- ------------------------------------------------------------
-- RLS POLICIES
-- ------------------------------------------------------------

ALTER TABLE edit_rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_room_reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_drives            ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_checkout_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_reservations      ENABLE ROW LEVEL SECURITY;

-- edit_rooms: all authenticated users can read; Post Producer/Admin/Producer can write
CREATE POLICY "edit_rooms_select" ON edit_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit_rooms_insert" ON edit_rooms FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "edit_rooms_update" ON edit_rooms FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));

-- edit_room_reservations
CREATE POLICY "edit_room_reservations_select" ON edit_room_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "edit_room_reservations_insert" ON edit_room_reservations FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "edit_room_reservations_update" ON edit_room_reservations FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "edit_room_reservations_delete" ON edit_room_reservations FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));

-- media_drives
CREATE POLICY "media_drives_select" ON media_drives FOR SELECT TO authenticated USING (true);
CREATE POLICY "media_drives_insert" ON media_drives FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "media_drives_update" ON media_drives FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "media_drives_delete" ON media_drives FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin'));

-- drive_checkout_sessions
CREATE POLICY "drive_checkout_sessions_select" ON drive_checkout_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "drive_checkout_sessions_insert" ON drive_checkout_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "drive_checkout_sessions_update" ON drive_checkout_sessions FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));

-- drive_checkout_items
CREATE POLICY "drive_checkout_items_select" ON drive_checkout_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "drive_checkout_items_insert" ON drive_checkout_items FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "drive_checkout_items_update" ON drive_checkout_items FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));

-- drive_reservations
CREATE POLICY "drive_reservations_select" ON drive_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "drive_reservations_insert" ON drive_reservations FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "drive_reservations_update" ON drive_reservations FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
CREATE POLICY "drive_reservations_delete" ON drive_reservations FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('Admin', 'Producer', 'Post Producer'));
