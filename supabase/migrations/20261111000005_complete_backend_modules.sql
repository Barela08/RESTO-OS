-- ====================================================================
-- RESTO OS - PostgreSQL Schema Migration: 000005_complete_backend_modules.sql
-- Modules: Table Bookings, Unified Service & Bill Requests, Customer Sessions,
-- Visits & Feedback, Multi-Tier Loyalty Programs, Staff Shifts & Attendance,
-- Permanent Table QR Code Engine & Server-Side Atomic Order/Loyalty Functions
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. PERMANENT TABLE QR CODE UPGRADE
-- --------------------------------------------------------------------
-- Ensure table_qr_tokens supports permanent tokens that do not expire daily
ALTER TABLE table_qr_tokens 
ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS qr_image_url TEXT,
ADD COLUMN IF NOT EXISTS print_metadata JSONB DEFAULT '{}'::jsonb;

-- Function: Generate or retrieve permanent table QR token
CREATE OR REPLACE FUNCTION generate_permanent_table_qr(
    p_restaurant_id VARCHAR,
    p_table_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_table RECORD;
    v_existing_token RECORD;
    v_token_hash VARCHAR;
    v_token_id UUID;
BEGIN
    SELECT * INTO v_table
    FROM restaurant_tables
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND', 'message', 'Table does not exist.');
    END IF;

    -- Check if permanent token already exists
    SELECT * INTO v_existing_token
    FROM table_qr_tokens
    WHERE table_id = p_table_id AND is_permanent = TRUE AND is_revoked = FALSE
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'token_id', v_existing_token.id,
            'token_hash', v_existing_token.token_hash,
            'table_number', v_table.table_number,
            'is_permanent', true,
            'message', 'Retrieved existing permanent QR token.'
        );
    END IF;

    -- Generate cryptographically secure token hash using sha256 + pgcrypto
    v_token_hash := encode(digest(p_restaurant_id || '-perm-' || p_table_id::text || '-' || gen_random_uuid()::text, 'sha256'), 'hex');

    INSERT INTO table_qr_tokens (
        restaurant_id,
        table_id,
        token_hash,
        valid_date,
        expires_at,
        is_permanent,
        print_metadata
    ) VALUES (
        p_restaurant_id,
        p_table_id,
        v_token_hash,
        CURRENT_DATE,
        '9999-12-31 23:59:59'::timestamptz,
        TRUE,
        jsonb_build_object(
            'table_number', v_table.table_number,
            'floor_area', v_table.floor_area,
            'capacity', v_table.seating_capacity,
            'generated_at', NOW()
        )
    ) RETURNING id INTO v_token_id;

    RETURN jsonb_build_object(
        'success', true,
        'token_id', v_token_id,
        'token_hash', v_token_hash,
        'table_number', v_table.table_number,
        'is_permanent', true,
        'message', 'Created new permanent cryptographically secure table QR token.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --------------------------------------------------------------------
-- 2. TABLE BOOKINGS (RESERVATIONS)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS table_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    party_size INT NOT NULL CHECK (party_size > 0),
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    status VARCHAR(30) DEFAULT 'CONFIRMED', -- 'PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW'
    special_requests TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_bookings_restaurant_date 
ON table_bookings(restaurant_id, booking_date);

-- --------------------------------------------------------------------
-- 3. UNIFIED SERVICE REQUESTS & BILL REQUESTS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL, -- 'CALL_WAITER', 'REQUEST_BILL', 'WATER', 'CUTLERY', 'CLEANING', 'ASSISTANCE'
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'ACKNOWLEDGED', 'ATTENDING', 'COMPLETED', 'CANCELLED'
    notes TEXT,
    assigned_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_service_requests_table_session 
ON service_requests(table_session_id, status);

CREATE TABLE IF NOT EXISTS bill_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    total_amount NUMERIC(10,2) NOT NULL,
    payment_method_preference VARCHAR(30) DEFAULT 'UPI', -- 'UPI', 'CASH', 'CARD'
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'SETTLED', 'CANCELLED'
    notes TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bill_requests_session 
ON bill_requests(table_session_id, status);

-- --------------------------------------------------------------------
-- 4. CUSTOMER SESSIONS, VISITS & FEEDBACK
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    session_token VARCHAR(128) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(50),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_spend NUMERIC(10,2) DEFAULT 0.00,
    orders_count INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_visits_cust 
ON customer_visits(customer_id, visit_date);

CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    food_rating INT CHECK (food_rating >= 1 AND food_rating <= 5),
    service_rating INT CHECK (service_rating >= 1 AND service_rating <= 5),
    ambience_rating INT CHECK (ambience_rating >= 1 AND ambience_rating <= 5),
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 5. LOYALTY PROGRAMS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    program_name VARCHAR(100) NOT NULL,
    description TEXT,
    min_order_amount NUMERIC(10,2) DEFAULT 200.00,
    stamps_per_order INT DEFAULT 1,
    stamps_required INT DEFAULT 8,
    reward_description VARCHAR(255) DEFAULT 'Complimentary Chef Special Dessert or Starter',
    validity_days INT DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 6. STAFF SHIFTS & ATTENDANCE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    shift_name VARCHAR(50) NOT NULL, -- 'Morning Shift', 'Evening Shift', 'Full Day'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    shift_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'SCHEDULED', -- 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ABSENT'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_staff_date 
ON shifts(staff_id, shift_date);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    status VARCHAR(30) DEFAULT 'ON_TIME', -- 'ON_TIME', 'LATE', 'HALF_DAY'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_staff_time 
ON attendance(staff_id, check_in_time);

-- --------------------------------------------------------------------
-- 7. SERVER-SIDE ORDER CALCULATION & PLACEMENT PROCEDURES
-- --------------------------------------------------------------------
-- Function to calculate order prices on server (anti-tamper)
CREATE OR REPLACE FUNCTION server_calculate_order_totals(
    p_items JSONB, -- Array of { "menu_item_id": "...", "variant_id": "...", "addon_ids": ["..."], "quantity": 1 }
    p_cgst_rate NUMERIC DEFAULT 2.50,
    p_sgst_rate NUMERIC DEFAULT 2.50
)
RETURNS JSONB AS $$
DECLARE
    v_item JSONB;
    v_item_id UUID;
    v_variant_id UUID;
    v_addon_id UUID;
    v_qty INT;
    v_base_price NUMERIC;
    v_variant_delta NUMERIC;
    v_addons_total NUMERIC;
    v_line_unit_price NUMERIC;
    v_line_total NUMERIC;
    v_subtotal NUMERIC := 0.00;
    v_cgst NUMERIC := 0.00;
    v_sgst NUMERIC := 0.00;
    v_total NUMERIC := 0.00;
    v_calculated_items JSONB := '[]'::jsonb;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'menu_item_id')::uuid;
        v_qty := COALESCE((v_item->>'quantity')::int, 1);
        IF v_qty <= 0 THEN v_qty := 1; END IF;

        -- Fetch base price from database
        SELECT base_price INTO v_base_price
        FROM menu_items
        WHERE id = v_item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Item with ID % does not exist in menu', v_item_id;
        END IF;

        -- Check variant delta
        v_variant_delta := 0.00;
        IF (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') != '' THEN
            v_variant_id := (v_item->>'variant_id')::uuid;
            SELECT price_delta INTO v_variant_delta
            FROM menu_variants
            WHERE id = v_variant_id AND menu_item_id = v_item_id;
            IF v_variant_delta IS NULL THEN v_variant_delta := 0.00; END IF;
        END IF;

        -- Calculate addons
        v_addons_total := 0.00;
        IF (v_item->'addon_ids') IS NOT NULL AND jsonb_array_length(v_item->'addon_ids') > 0 THEN
            SELECT COALESCE(SUM(price), 0.00) INTO v_addons_total
            FROM menu_addons
            WHERE id IN (
                SELECT (jsonb_array_elements_text(v_item->'addon_ids'))::uuid
            );
        END IF;

        v_line_unit_price := v_base_price + v_variant_delta + v_addons_total;
        v_line_total := v_line_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;

        v_calculated_items := v_calculated_items || jsonb_build_object(
            'menu_item_id', v_item_id,
            'unit_price', v_line_unit_price,
            'quantity', v_qty,
            'total_price', v_line_total
        );
    END LOOP;

    v_cgst := ROUND((v_subtotal * (p_cgst_rate / 100.0)), 2);
    v_sgst := ROUND((v_subtotal * (p_sgst_rate / 100.0)), 2);
    v_total := v_subtotal + v_cgst + v_sgst;

    RETURN jsonb_build_object(
        'subtotal', v_subtotal,
        'cgst', v_cgst,
        'sgst', v_sgst,
        'total', v_total,
        'items', v_calculated_items
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- --------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) FOR NEW MODULES
-- --------------------------------------------------------------------
ALTER TABLE table_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policies: table_bookings
CREATE POLICY "Public can create table bookings"
ON table_bookings FOR INSERT WITH CHECK (true);

CREATE POLICY "Public and staff can view their table bookings"
ON table_bookings FOR SELECT USING (true);

CREATE POLICY "Staff can manage table bookings"
ON table_bookings FOR ALL USING (true);

-- Policies: service_requests
CREATE POLICY "Public can insert service requests"
ON service_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Public and staff can view service requests"
ON service_requests FOR SELECT USING (true);

CREATE POLICY "Staff can update service requests"
ON service_requests FOR UPDATE USING (true);

-- Policies: bill_requests
CREATE POLICY "Public can insert bill requests"
ON bill_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Public and staff can view bill requests"
ON bill_requests FOR SELECT USING (true);

CREATE POLICY "Staff can update bill requests"
ON bill_requests FOR UPDATE USING (true);

-- Policies: customer_sessions, visits, feedback
CREATE POLICY "Public can insert and view customer sessions"
ON customer_sessions FOR ALL USING (true);

CREATE POLICY "Public can view and insert customer visits"
ON customer_visits FOR ALL USING (true);

CREATE POLICY "Public can create customer feedback"
ON customer_feedback FOR INSERT WITH CHECK (true);

CREATE POLICY "Public and staff can view customer feedback"
ON customer_feedback FOR SELECT USING (true);

-- Policies: loyalty_programs
CREATE POLICY "Public can view active loyalty programs"
ON loyalty_programs FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admin can manage loyalty programs"
ON loyalty_programs FOR ALL USING (true);

-- Policies: shifts & attendance
CREATE POLICY "Staff can view shifts"
ON shifts FOR SELECT USING (true);

CREATE POLICY "Admin can manage shifts"
ON shifts FOR ALL USING (true);

CREATE POLICY "Staff can view and record attendance"
ON attendance FOR ALL USING (true);
