-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CREATE TABLE couriers (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name VARCHAR(100) NOT NULL,
--   phone VARCHAR(20),
--   status VARCHAR(20) DEFAULT 'available',
--   created_at TIMESTAMP DEFAULT NOW(),
--   updated_at TIMESTAMP DEFAULT NOW()
-- );

-- ALTER TABLE couriers
--   DROP CONSTRAINT IF EXISTS couriers_status_check;

-- ALTER TABLE couriers
--   ADD CONSTRAINT couriers_status_check
--   CHECK (status IN ('available', 'assigned', 'in_transit', 'inactive', 'off_duty'));


-- CREATE OR REPLACE FUNCTION update_couriers_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- DROP TRIGGER IF EXISTS trg_update_couriers_updated_at ON couriers;

-- CREATE TRIGGER trg_update_couriers_updated_at
-- BEFORE UPDATE ON couriers
-- FOR EACH ROW
-- EXECUTE FUNCTION update_couriers_updated_at();

-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_couriers_status') THEN
--     CREATE INDEX idx_couriers_status ON couriers(status);
--   END IF;

--   IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_couriers_name') THEN
--     CREATE INDEX idx_couriers_name ON couriers(name);
--   END IF;
-- END $$;
