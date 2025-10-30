-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================== NOTIFICATIONS TABLE ==================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    type VARCHAR(50) DEFAULT 'general' CHECK (type IN (
        'general', 'order', 'delivery', 'payment', 'system', 'promotion', 'user'
    )),

    data JSONB,  -- optional: store dynamic info (e.g. {"order_id": "...", "amount": 45.00})

    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- Trigger: Auto-update updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_notifications_updated_at ON notifications;

CREATE TRIGGER trg_update_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_notifications_updated_at();

-- ===========================================
-- Indexes for performance
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_notifications_target_user') THEN
        CREATE INDEX idx_notifications_target_user ON notifications(target_user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_notifications_is_read') THEN
        CREATE INDEX idx_notifications_is_read ON notifications(is_read);
    END IF;

    -- For filtering unread notifications for a specific user (dashboard)
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_notifications_unread_user') THEN
        CREATE INDEX idx_notifications_unread_user 
        ON notifications(target_user_id) 
        WHERE is_read = FALSE;
    END IF;
END $$;
