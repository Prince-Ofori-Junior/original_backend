-- ================== ORDER STATUS HISTORY TABLE ==================
-- Tracks every status change for audit and premium tracking
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_by UUID,                                      -- admin/user who changed the status
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


DO $$
BEGIN
-- Status history index
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_order_status_history_order') THEN
        CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
    END IF;
END $$;
