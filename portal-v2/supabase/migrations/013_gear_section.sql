-- Add section column to gear_items to distinguish Gear vs Props inventory
ALTER TABLE gear_items
  ADD COLUMN section text NOT NULL DEFAULT 'Gear'
  CHECK (section IN ('Gear', 'Props'));

-- Index for fast filtering by section
CREATE INDEX idx_gear_items_section ON gear_items (section);
