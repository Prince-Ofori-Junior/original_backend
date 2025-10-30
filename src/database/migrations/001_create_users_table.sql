-- Enable UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user','admin')),
    address TEXT,
    phone VARCHAR(20) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    reset_token VARCHAR(255),
    reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ALTER TABLE users 
-- ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
-- ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT FALSE,
-- ADD COLUMN IF NOT EXISTS premium_plan VARCHAR(50),
-- ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMP;

-- ALTER TABLE users
-- ADD COLUMN connected_accounts JSONB DEFAULT '{}';


-- ALTER TABLE users
-- ADD COLUMN avatar TEXT;  -- URL or path to avatar image

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_active_role
ON users(role)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
