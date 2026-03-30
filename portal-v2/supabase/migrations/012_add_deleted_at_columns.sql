-- Add soft delete support to campaigns
ALTER TABLE campaigns ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient filtering of non-deleted campaigns
CREATE INDEX idx_campaigns_deleted_at ON campaigns(deleted_at) WHERE deleted_at IS NULL;

-- Update list queries to filter out deleted campaigns
-- This is enforced at the application layer, but adding for data safety
COMMENT ON COLUMN campaigns.deleted_at IS 'Timestamp when campaign was soft-deleted. NULL means active.';
