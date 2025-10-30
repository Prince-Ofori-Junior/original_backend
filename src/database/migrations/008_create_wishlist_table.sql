-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== WISHLIST TABLE ==================
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    note TEXT,  -- optional: user can save notes like "buy on Black Friday"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_product UNIQUE (user_id, product_id)
);

-- ===========================================
-- Trigger Function: Auto-update updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION update_wishlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger safely
DROP TRIGGER IF EXISTS trg_update_wishlist_updated_at ON wishlists;

CREATE TRIGGER trg_update_wishlist_updated_at
BEFORE UPDATE ON wishlists
FOR EACH ROW
EXECUTE FUNCTION update_wishlist_updated_at();

-- ===========================================
-- Indexes for Performance (✅ Fixed)
-- ===========================================
DO $$
BEGIN
    -- Fast lookup by user
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_wishlist_user') THEN
        CREATE INDEX idx_wishlist_user ON wishlists(user_id);
    END IF;

    -- Fast lookup by product
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_wishlist_product') THEN
        CREATE INDEX idx_wishlist_product ON wishlists(product_id);
    END IF;

    -- ❌ Removed invalid subquery-based index
END $$;
