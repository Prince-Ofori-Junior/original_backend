-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== ROLES TABLE ==================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- unique role ID
    name VARCHAR(50) UNIQUE NOT NULL,               -- role name
    description TEXT,                               -- optional description
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optional index for faster lookups by name
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_roles_name') THEN
        CREATE INDEX idx_roles_name ON roles(name);
    END IF;
END $$;
