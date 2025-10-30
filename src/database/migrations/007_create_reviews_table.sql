-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== REVIEWS TABLE ==================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),       -- unique review ID
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,  -- reference to product
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,        -- reference to user
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),             -- rating between 1-5
    comment TEXT,                                                        -- review comment
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                      -- creation timestamp
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                      -- last update timestamp
    CONSTRAINT uq_review UNIQUE (product_id, user_id)                    -- unique review per user per product
);

-- Indexes for fast lookups
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_reviews_product') THEN
        CREATE INDEX idx_reviews_product ON reviews(product_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_reviews_user') THEN
        CREATE INDEX idx_reviews_user ON reviews(user_id);
    END IF;
END $$;
