-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== DELIVERIES TABLE ==================
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    courier VARCHAR(150),
    
    tracking_number VARCHAR(100) UNIQUE,  -- optional: integrate with courier APIs
    delivery_fee NUMERIC(10,2) DEFAULT 0.00, -- for reporting or premium delivery
    
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending', 
            'processing', 
            'dispatched',
            'in_transit', 
            'shipped',
            'delivered', 
            'completed', 
            'cancelled', 
            'failed', 
            'returned', 
            'refunded'
        )),
    
    estimated_delivery TIMESTAMP,          -- for ETA tracking
    delivered_at TIMESTAMP,                -- when actually delivered

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Trigger: Auto-update 'updated_at' column
-- ===========================================
CREATE OR REPLACE FUNCTION update_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_deliveries_updated_at ON deliveries;

CREATE TRIGGER trg_update_deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_deliveries_updated_at();

-- ===========================================
-- Indexes for Performance
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_deliveries_order_id') THEN
        CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_deliveries_status') THEN
        CREATE INDEX idx_deliveries_status ON deliveries(status);
    END IF;

    -- Optional: index for active (non-delivered) deliveries
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_deliveries_active') THEN
        CREATE INDEX idx_deliveries_active 
        ON deliveries(status) 
        WHERE status NOT IN ('completed', 'delivered', 'cancelled', 'failed');
    END IF;
END $$;
