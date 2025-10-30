-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== PRODUCTS TABLE ==================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),   -- unique product ID
    name VARCHAR(255) NOT NULL,                       -- product name
    description TEXT,                                 -- product details
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),  -- price must be positive
    stock INT NOT NULL CHECK (stock >= 0),            -- stock quantity
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE, -- linked category
    image_url TEXT NOT NULL,                          -- uploaded product image path
    is_active BOOLEAN DEFAULT TRUE,                   -- active/inactive
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- created timestamp
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP    -- last updated
);

-- Helpful indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_products_category') THEN
        CREATE INDEX idx_products_category ON products(category_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_products_name') THEN
        CREATE INDEX idx_products_name ON products(name);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_products_active') THEN
        CREATE INDEX idx_products_active ON products(is_active);
    END IF;
END $$;