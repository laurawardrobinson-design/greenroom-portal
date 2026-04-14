-- Add 'Post Producer' to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Post Producer';
