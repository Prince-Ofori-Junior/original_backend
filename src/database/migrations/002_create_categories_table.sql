-- Enable UUIDs (if not already)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- Secure and fast UUIDs
  name CITEXT UNIQUE NOT NULL,                     -- Case-insensitive category names
  description TEXT,                                -- Optional details
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When it was created
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- When it was last updated
);

-- ✅ Helpful index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
