-- ====================================================================
-- RESTO OS - Staff Authentication, RBAC, Security Audit & Rate Limiting
-- Migration: 20261111000008_auth_security_and_staff_management.sql
-- ====================================================================

-- 1. Upgrade profiles table for staff account authentication & lockout protection
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE,
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Ensure profiles role constraint strictly encompasses all 5 staff roles
DO $$
BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_role;
    ALTER TABLE profiles ADD CONSTRAINT chk_profiles_role
        CHECK (role IN ('owner', 'admin', 'counter', 'waiter', 'kitchen'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. Create Security Audit Logs table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    event_type VARCHAR(60) NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    username VARCHAR(100),
    role VARCHAR(50),
    ip_address VARCHAR(100) DEFAULT '127.0.0.1',
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index audit logs for rapid querying by restaurant and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_time 
    ON security_audit_logs(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type 
    ON security_audit_logs(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_username 
    ON security_audit_logs(username, created_at DESC);

-- 3. Create Login Rate Limits table
CREATE TABLE IF NOT EXISTS login_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(150) NOT NULL,
    ip_address VARCHAR(100) NOT NULL,
    failed_attempts INT DEFAULT 0,
    last_failed_at TIMESTAMPTZ DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_login_rate_limit UNIQUE (identifier, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_login_rate_limits_id_ip 
    ON login_rate_limits(identifier, ip_address);

-- 4. Customer Trusted Devices table for seamless mobile auto-recognition
CREATE TABLE IF NOT EXISTS customer_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    device_name VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_customer_device UNIQUE (customer_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_customer_trusted_devices_token 
    ON customer_trusted_devices(device_token);

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_trusted_devices ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Security Audit Logs: Only owner and admin can view audit logs
CREATE POLICY security_audit_logs_owner_admin_view
    ON security_audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('owner', 'admin')
            AND profiles.is_active = true
        )
    );

-- System service can insert audit logs
CREATE POLICY security_audit_logs_insert_service
    ON security_audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Customer Trusted Devices: Customers can view/manage their own trusted devices
CREATE POLICY customer_trusted_devices_own
    ON customer_trusted_devices
    FOR ALL
    USING (customer_id IN (
        SELECT id FROM customers WHERE auth.uid()::text = id::text OR auth.role() = 'authenticated'
    ));

-- Staff profiles management: Owner and Admin can manage all staff accounts
CREATE POLICY staff_profiles_owner_admin_all
    ON profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('owner', 'admin')
            AND p.is_active = true
        )
    );

-- Staff can view their own profile
CREATE POLICY staff_profiles_self_view
    ON profiles
    FOR SELECT
    USING (id = auth.uid() AND is_active = true);
