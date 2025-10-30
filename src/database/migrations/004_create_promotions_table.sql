-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== PROMOTIONS TABLE ==================
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),   -- unique promotion ID
    code VARCHAR(50) NOT NULL UNIQUE,                -- promotion code (unique)
    description TEXT,                                -- optional description
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),  -- discount type
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0), -- value of discount
    start_date TIMESTAMP NOT NULL,                   -- promotion start
    end_date TIMESTAMP NOT NULL,                     -- promotion end
    active BOOLEAN DEFAULT TRUE,                     -- is promotion active
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- creation timestamp
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- last update timestamp
);

-- Indexes for fast lookup (created safely)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_promotions_code') THEN
        CREATE INDEX idx_promotions_code ON promotions(code);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_promotions_active') THEN
        CREATE INDEX idx_promotions_active ON promotions(active);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_promotions_start_end') THEN
        CREATE INDEX idx_promotions_start_end ON promotions(start_date, end_date);
    END IF;
END $$;
