-- Enable UUIDs if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- safer and distributed ID system

    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    email VARCHAR(150),         -- store attempted email (for failed logins where user_id not found)
    ip_address VARCHAR(50),     -- track where attempt came from
    user_agent TEXT,            -- optional: track browser or device type

    success BOOLEAN NOT NULL,   -- whether login succeeded
    failure_reason TEXT,        -- store reason (e.g. "wrong password", "invalid user")

    location TEXT,              -- optional: inferred from IP (city, country)
    created_at TIMESTAMP DEFAULT NOW()
);


DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_login_attempts_user') THEN
        CREATE INDEX idx_login_attempts_user ON login_attempts(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_login_attempts_ip') THEN
        CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_login_attempts_created_at') THEN
        CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at DESC);
    END IF;
END $$;
