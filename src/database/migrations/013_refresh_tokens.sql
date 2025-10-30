CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- safer unique ID (instead of serial)
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- store a hashed token, not plaintext
    token_hash TEXT NOT NULL,  
    
    user_agent TEXT,          -- optional: store browser/app/device info
    ip_address TEXT,          -- optional: track device IP
    revoked BOOLEAN DEFAULT FALSE,  -- flag if user logs out or session is invalidated

    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


-- ALTER TABLE refresh_tokens ADD COLUMN revoked BOOLEAN DEFAULT FALSE;


-- Trigger to auto-update 'updated_at'
CREATE OR REPLACE FUNCTION update_refresh_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_refresh_tokens_updated_at ON refresh_tokens;

CREATE TRIGGER trg_update_refresh_tokens_updated_at
BEFORE UPDATE ON refresh_tokens
FOR EACH ROW
EXECUTE FUNCTION update_refresh_tokens_updated_at();

-- Helpful indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_refresh_tokens_user') THEN
        CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_refresh_tokens_expires_at') THEN
        CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_refresh_tokens_revoked') THEN
        CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens(revoked);
    END IF;
END $$;


