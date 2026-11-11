-- ====================================================================
-- RESTO OS - Realtime Waiter Calling, Sound Alert & Voice Announcement Migration
-- Migration: 20261111000007_waiter_call_workflow_and_voice.sql
-- ====================================================================

-- 1. Upgrade waiter_calls table with all required workflow fields
ALTER TABLE waiter_calls 
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS request_message TEXT,
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL', -- 'NORMAL', 'URGENT'
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS on_the_way_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS response_time_seconds NUMERIC(10,2);

-- 2. Ensure status check allows all 8 workflow states
-- 'REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'ESCALATED', plus legacy 'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'
DO $$
BEGIN
    ALTER TABLE waiter_calls DROP CONSTRAINT IF EXISTS chk_waiter_calls_status;
    ALTER TABLE waiter_calls ADD CONSTRAINT chk_waiter_calls_status 
        CHECK (status IN (
            'REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 
            'COMPLETED', 'CANCELLED', 'ESCALATED', 
            'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'
        ));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Add operational settings to restaurant_settings
ALTER TABLE restaurant_settings
    ADD COLUMN IF NOT EXISTS waiter_escalation_timeout_seconds INT DEFAULT 60,
    ADD COLUMN IF NOT EXISTS backup_waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS waiter_voice_enabled BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS waiter_voice_language VARCHAR(10) DEFAULT 'hi',
    ADD COLUMN IF NOT EXISTS waiter_sound_volume NUMERIC(3,2) DEFAULT 0.85;

-- 4. High-performance indexes for realtime subscription filtering
CREATE INDEX IF NOT EXISTS idx_waiter_calls_assigned_status 
    ON waiter_calls(restaurant_id, assigned_waiter_id, status);

CREATE INDEX IF NOT EXISTS idx_waiter_calls_session_status 
    ON waiter_calls(table_session_id, status);

CREATE INDEX IF NOT EXISTS idx_waiter_calls_created_at 
    ON waiter_calls(restaurant_id, created_at DESC);

-- 5. Enable Realtime Replication
ALTER TABLE waiter_calls REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'waiter_calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
