-- Campaign-specific role label overrides
-- Allows producers to set a person's role for a specific campaign
-- e.g. a vendor booked as "Key Grip" even though their category is "Lighting"

ALTER TABLE campaign_producers ADD COLUMN IF NOT EXISTS campaign_role text;
ALTER TABLE campaign_vendors ADD COLUMN IF NOT EXISTS campaign_role text;
