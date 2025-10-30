-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== ORDER ITEMS TABLE ==================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),          -- unique line-item ID

    order_id UUID NOT NULL 
        REFERENCES orders(id) ON DELETE CASCADE,             -- when order deleted, items deleted

    product_id UUID 
        REFERENCES products(id) ON DELETE SET NULL,          -- retain item record even if product removed

    quantity INT NOT NULL CHECK (quantity > 0),              -- must be > 0
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),         -- item price at order time

    subtotal NUMERIC(10,2) GENERATED ALWAYS AS (quantity * price) STORED, -- ✅ auto-calculated subtotal

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


DO $$
BEGIN
    -- Query items by order (very common)
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_order_items_order') THEN
        CREATE INDEX idx_order_items_order ON order_items(order_id);
    END IF;

    -- Query by product (e.g., sales per product report)
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_order_items_product') THEN
        CREATE INDEX idx_order_items_product ON order_items(product_id);
    END IF;

    -- For analytics: fast lookups by created date
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_order_items_created') THEN
        CREATE INDEX idx_order_items_created ON order_items(created_at);
    END IF;
END $$;
