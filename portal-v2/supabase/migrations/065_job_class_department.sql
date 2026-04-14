-- Add department and restrictions columns to job_classes
ALTER TABLE job_classes ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Other';
ALTER TABLE job_classes ADD COLUMN IF NOT EXISTS restrictions TEXT DEFAULT '';
