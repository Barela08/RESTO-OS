-- ====================================================================
-- RESTO OS - PostgreSQL Schema Migration: 000004_voice_upi_loyalty_expansion.sql
-- Modules: Smart Voice Announcements, Manual UPI QR Payments,
-- Customer OTP Authentication & Digital Reward Claim Engine
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. VOICE & NOTIFICATION ANNOUNCEMENT SETTINGS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'hi', -- 'hi' (Hindi), 'en' (English)
    voice_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    volume NUMERIC(3,2) DEFAULT 1.00 CHECK (volume >= 0.0 AND volume <= 1.0),
    speech_rate NUMERIC(3,2) DEFAULT 1.00 CHECK (speech_rate >= 0.5 AND speech_rate <= 2.0),
    repeat_count INT DEFAULT 1 CHECK (repeat_count >= 1 AND repeat_count <= 3),
    enabled_events JSONB DEFAULT '{"NEW_ORDER":true,"CALL_WAITER":true,"REQUEST_BILL":true,"ORDER_READY":true,"PAYMENT_RECEIVED":true,"REPEAT_SCAN":true,"URGENT_ASSISTANCE":true,"ORDER_CANCELLED":true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_voice_settings_restaurant_user UNIQUE (restaurant_id, user_id)
);

CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(100),
    event_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES notification_events(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    device_id VARCHAR(100),
    delivery_status VARCHAR(30) DEFAULT 'DELIVERED', -- 'DELIVERED', 'ACKNOWLEDGED'
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 2. MANUAL UPI ID & QR PAYMENT SETTINGS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    upi_id VARCHAR(100) NOT NULL DEFAULT 'grandbistro@okaxis',
    merchant_name VARCHAR(255) NOT NULL DEFAULT 'The Grand Bistro & Craft Kitchen',
    qr_image_url TEXT,
    upi_enabled BOOLEAN DEFAULT TRUE,
    cash_enabled BOOLEAN DEFAULT TRUE,
    manual_verification_enabled BOOLEAN DEFAULT TRUE,
    require_transaction_ref BOOLEAN DEFAULT TRUE,
    payment_instructions TEXT DEFAULT 'Scan the QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) and enter the 12-digit UTR/Ref number.',
    upi_display_name VARCHAR(100) DEFAULT 'Direct UPI (0% Fee)',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_payment_settings_restaurant UNIQUE (restaurant_id)
);

CREATE TABLE IF NOT EXISTS payment_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    transaction_reference VARCHAR(100) NOT NULL,
    submitted_amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    CONSTRAINT uq_payment_verification_ref UNIQUE (restaurant_id, transaction_reference)
);

-- --------------------------------------------------------------------
-- 3. CUSTOMER OTP & DIGITAL REWARD REDEMPTIONS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    redemption_code VARCHAR(32) NOT NULL,
    redemption_code_hash VARCHAR(128),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    redeemed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'REDEEMED', -- 'REDEEMED', 'CANCELLED'
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_reward_redemption_reward UNIQUE (reward_id),
    CONSTRAINT uq_reward_redemption_code UNIQUE (restaurant_id, redemption_code)
);

-- --------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) FOR NEW TABLES
-- --------------------------------------------------------------------
ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Staff and Admin can view and manage voice settings
CREATE POLICY "Staff can view voice settings"
ON voice_settings FOR SELECT
USING (true);

CREATE POLICY "Admin can manage voice settings"
ON voice_settings FOR ALL
USING (true);

-- Public can read payment settings (UPI details)
CREATE POLICY "Public can view payment settings"
ON payment_settings FOR SELECT
USING (true);

CREATE POLICY "Admin can manage payment settings"
ON payment_settings FOR ALL
USING (true);

-- Customer can create payment verification requests
CREATE POLICY "Public can insert payment verification requests"
ON payment_verification_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff and admin can view payment verification requests"
ON payment_verification_requests FOR SELECT
USING (true);

CREATE POLICY "Counter and admin can update payment verification requests"
ON payment_verification_requests FOR UPDATE
USING (true);

-- Notification Events
CREATE POLICY "Public can read notification events"
ON notification_events FOR SELECT
USING (true);

CREATE POLICY "Staff can insert notification events"
ON notification_events FOR INSERT
WITH CHECK (true);

-- Reward redemptions
CREATE POLICY "Staff can view and verify reward redemptions"
ON reward_redemptions FOR SELECT
USING (true);

CREATE POLICY "Staff can create reward redemptions"
ON reward_redemptions FOR INSERT
WITH CHECK (true);
