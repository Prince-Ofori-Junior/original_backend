CREATE TABLE IF NOT EXISTS payment_sub_channels (
    id SERIAL PRIMARY KEY,
    method_code VARCHAR(50) REFERENCES payment_methods(code) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,      -- e.g. 'visa', 'mastercard', 'mtn', 'vodafone'
    label VARCHAR(100) NOT NULL,    -- e.g. 'Visa', 'Vodafone Cash'
    description TEXT,
    icon VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (method_code, code)
);


CREATE OR REPLACE FUNCTION update_payment_sub_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_sub_channels_updated_at ON payment_sub_channels;

CREATE TRIGGER trg_payment_sub_channels_updated_at
BEFORE UPDATE ON payment_sub_channels
FOR EACH ROW
EXECUTE FUNCTION update_payment_sub_channels_updated_at();


DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_sub_channels_method_code') THEN
        CREATE INDEX idx_sub_channels_method_code ON payment_sub_channels(method_code);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_sub_channels_is_active') THEN
        CREATE INDEX idx_sub_channels_is_active ON payment_sub_channels(is_active);
    END IF;
END $$;
