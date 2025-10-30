-- ================== PAYMENT METHODS ==================
CREATE TABLE IF NOT EXISTS payment_methods (
    code VARCHAR(50) PRIMARY KEY,         -- 'card', 'momo', 'cod', 'paypal'
    label VARCHAR(100) NOT NULL,          -- e.g. 'Credit/Debit Card'
    description TEXT,
    icon VARCHAR(255),                    -- '/uploads/payment-icons/card.png' or external URL
    provider VARCHAR(100),                -- e.g. 'Stripe', 'Flutterwave', 'Paystack'
    metadata JSONB DEFAULT '{}'::JSONB,   -- store dynamic data like API keys or gateway configs
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);


CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_methods_updated_at ON payment_methods;

CREATE TRIGGER trg_payment_methods_updated_at
BEFORE UPDATE ON payment_methods
FOR EACH ROW
EXECUTE FUNCTION update_payment_methods_updated_at();



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_payment_methods_is_active') THEN
        CREATE INDEX idx_payment_methods_is_active ON payment_methods(is_active);
    END IF;
END $$;
