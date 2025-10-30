-- Enable UUID and CITEXT extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ================== ORDERS TABLE ==================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),       -- unique order ID
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- linked to user
    address TEXT NOT NULL,                                -- flexible delivery address
    phone VARCHAR(20),                                    -- optional customer phone
    is_premium BOOLEAN DEFAULT FALSE,                     -- premium order flag

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending','processing','shipped','delivered',
            'completed','cancelled','failed','returned','refunded'
        )),

    approved_by_admin BOOLEAN DEFAULT FALSE,              -- admin approval flag
    total_amount NUMERIC(10,2) DEFAULT 0.00 CHECK (total_amount >= 0), -- validated order total

    payment_method CITEXT DEFAULT 'paystack',             -- paystack, stripe, flutterwave, etc.
    payment_channel CITEXT DEFAULT 'card:visa',           -- card, momo, etc.
    payment_reference VARCHAR(150) UNIQUE,                -- ensure uniqueness per payment

    estimated_delivery TIMESTAMP,                         -- optional delivery ETA

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- ================== INDEXES ==================
DO $$
BEGIN
    -- Query user order history quickly
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_orders_user') THEN
        CREATE INDEX idx_orders_user ON orders(user_id);
    END IF;

    -- Filter dashboard/order reports by status fast
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_orders_status') THEN
        CREATE INDEX idx_orders_status ON orders(status);
    END IF;

    -- Payment verification and duplicate prevention
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_orders_payment_ref') THEN
        CREATE UNIQUE INDEX idx_orders_payment_ref ON orders(payment_reference);
    END IF;

    -- Filter or monitor orders by delivery ETA
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_orders_estimated_delivery') THEN
        CREATE INDEX idx_orders_estimated_delivery ON orders(estimated_delivery);
    END IF;
END $$;
