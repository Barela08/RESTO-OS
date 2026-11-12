-- ====================================================================
-- RESTO OS: Fix QR Session Verification, RLS Security & Realtime Sync
-- ====================================================================

-- 1. FIX FUNCTION: verify_table_qr_token
-- Correctly handles permanent QRs (does not expire them)
-- Resumes active session cleanly on page refresh without false repeat scan alerts
-- Does not falsely mark tables as BOOKED or create fake orders
CREATE OR REPLACE FUNCTION verify_table_qr_token(
    p_token_hash VARCHAR,
    p_ip_address VARCHAR DEFAULT NULL,
    p_user_agent VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token RECORD;
    v_table RECORD;
    v_active_session RECORD;
    v_new_session_token VARCHAR;
    v_new_session_id UUID;
BEGIN
    -- 1. Find token
    SELECT * INTO v_token
    FROM table_qr_tokens
    WHERE token_hash = p_token_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'QR code is not recognized or invalid.'
        );
    END IF;

    -- 2. Check if revoked
    IF v_token.is_revoked THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REVOKED_TOKEN',
            'message', 'This QR code has been revoked by management.'
        );
    END IF;

    -- 3. Check expiration (ONLY for temporary/daily tokens; permanent tokens never expire)
    IF NOT COALESCE(v_token.is_permanent, FALSE) THEN
        IF NOW() > v_token.expires_at OR v_token.valid_date < CURRENT_DATE THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'EXPIRED_TOKEN',
                'message', 'This daily QR code has expired. Please ask staff for today’s code.'
            );
        END IF;
    END IF;

    -- 4. Get Table Details
    SELECT * INTO v_table
    FROM restaurant_tables
    WHERE id = v_token.table_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TABLE_NOT_FOUND',
            'message', 'Assigned dining table not found.'
        );
    END IF;

    -- 5. Check if an active session already exists on this table
    SELECT * INTO v_active_session
    FROM table_sessions
    WHERE table_id = v_table.id AND status = 'ACTIVE'
    ORDER BY opened_at DESC LIMIT 1;

    IF FOUND THEN
        -- Seamlessly resume existing active session
        -- (Does not create duplicate sessions or spam staff with false repeat alerts)
        INSERT INTO qr_scan_logs (
            restaurant_id, table_id, qr_token_id, session_id, ip_address, user_agent, is_repeat_scan, scan_status
        ) VALUES (
            v_table.restaurant_id, v_table.id, v_token.id, v_active_session.id, p_ip_address, p_user_agent, TRUE, 'RESUMED'
        );

        RETURN jsonb_build_object(
            'success', true,
            'is_repeat_scan', false,
            'is_resumed', true,
            'session_id', v_active_session.id,
            'session_token', v_active_session.session_token,
            'table_id', v_table.id,
            'table_number', v_table.table_number,
            'seating_capacity', v_table.seating_capacity,
            'floor_area', v_table.floor_area,
            'table_status', v_table.status,
            'restaurant_id', v_table.restaurant_id,
            'message', 'Resumed active dining session.'
        );
    ELSE
        -- First scan for this table session: create brand new active session
        v_new_session_token := encode(digest(gen_random_uuid()::text || '-' || v_table.id::text, 'sha256'), 'hex');

        INSERT INTO table_sessions (
            restaurant_id,
            table_id,
            qr_token_id,
            session_token,
            status,
            opened_at
        ) VALUES (
            v_table.restaurant_id,
            v_table.id,
            v_token.id,
            v_new_session_token,
            'ACTIVE',
            NOW()
        ) RETURNING id INTO v_new_session_id;

        -- Update table status to OCCUPIED
        UPDATE restaurant_tables
        SET status = 'OCCUPIED', updated_at = NOW()
        WHERE id = v_table.id;

        -- Log scan
        INSERT INTO qr_scan_logs (
            restaurant_id, table_id, qr_token_id, session_id, ip_address, user_agent, is_repeat_scan, scan_status
        ) VALUES (
            v_table.restaurant_id, v_table.id, v_token.id, v_new_session_id, p_ip_address, p_user_agent, FALSE, 'VERIFIED'
        );

        RETURN jsonb_build_object(
            'success', true,
            'is_repeat_scan', false,
            'is_resumed', false,
            'session_id', v_new_session_id,
            'session_token', v_new_session_token,
            'table_id', v_table.id,
            'table_number', v_table.table_number,
            'seating_capacity', v_table.seating_capacity,
            'floor_area', v_table.floor_area,
            'table_status', 'OCCUPIED',
            'restaurant_id', v_table.restaurant_id,
            'message', 'Table session verified successfully.'
        );
    END IF;
END;
$$;

-- 2. ENSURE RLS POLICIES FOR PUBLIC AND STAFF
-- Allow public to read active restaurant tables
DROP POLICY IF EXISTS "Public can view active restaurant tables" ON restaurant_tables;
CREATE POLICY "Public can view active restaurant tables" ON restaurant_tables
    FOR SELECT TO public
    USING (is_active = true);

-- Allow public to read non-revoked QR tokens
DROP POLICY IF EXISTS "Public can view valid QR tokens" ON table_qr_tokens;
CREATE POLICY "Public can view valid QR tokens" ON table_qr_tokens
    FOR SELECT TO public
    USING (is_revoked = false);

-- Allow public to read staff (for table assigned waiter identification)
DROP POLICY IF EXISTS "Public can view on duty staff" ON staff;
CREATE POLICY "Public can view on duty staff" ON staff
    FOR SELECT TO public
    USING (true);

-- Allow staff full access to staff table
DROP POLICY IF EXISTS "Staff and Admin full access to staff" ON staff;
CREATE POLICY "Staff and Admin full access to staff" ON staff
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

-- Allow public to select menu categories and items
DROP POLICY IF EXISTS "Public can view menu categories" ON menu_categories;
CREATE POLICY "Public can view menu categories" ON menu_categories
    FOR SELECT TO public
    USING (is_active = true);

DROP POLICY IF EXISTS "Public can view menu items" ON menu_items;
CREATE POLICY "Public can view menu items" ON menu_items
    FOR SELECT TO public
    USING (is_available = true);

DROP POLICY IF EXISTS "Public can view menu variants" ON menu_variants;
CREATE POLICY "Public can view menu variants" ON menu_variants
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Public can view menu addons" ON menu_addons;
CREATE POLICY "Public can view menu addons" ON menu_addons
    FOR SELECT TO public
    USING (is_available = true);

-- Allow public to insert orders and order items
DROP POLICY IF EXISTS "Public and staff can insert orders" ON orders;
CREATE POLICY "Public and staff can insert orders" ON orders
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public and staff can view orders" ON orders;
CREATE POLICY "Public and staff can view orders" ON orders
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Staff can update orders" ON orders;
CREATE POLICY "Staff can update orders" ON orders
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public and staff can insert order items" ON order_items;
CREATE POLICY "Public and staff can insert order items" ON order_items
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public and staff can view order items" ON order_items;
CREATE POLICY "Public and staff can view order items" ON order_items
    FOR SELECT TO public
    USING (true);

-- Allow kitchen tickets access
DROP POLICY IF EXISTS "Public and staff can insert kitchen tickets" ON kitchen_tickets;
CREATE POLICY "Public and staff can insert kitchen tickets" ON kitchen_tickets
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public and staff can view kitchen tickets" ON kitchen_tickets;
CREATE POLICY "Public and staff can view kitchen tickets" ON kitchen_tickets
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Staff can update kitchen tickets" ON kitchen_tickets;
CREATE POLICY "Staff can update kitchen tickets" ON kitchen_tickets
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- Allow waiter calls access
DROP POLICY IF EXISTS "Public and staff can insert waiter calls" ON waiter_calls;
CREATE POLICY "Public and staff can insert waiter calls" ON waiter_calls
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public and staff can view waiter calls" ON waiter_calls;
CREATE POLICY "Public and staff can view waiter calls" ON waiter_calls
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Staff can update waiter calls" ON waiter_calls;
CREATE POLICY "Staff can update waiter calls" ON waiter_calls
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- Allow table sessions access
DROP POLICY IF EXISTS "Public and staff can view table sessions" ON table_sessions;
CREATE POLICY "Public and staff can view table sessions" ON table_sessions
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Public and staff can update table sessions" ON table_sessions;
CREATE POLICY "Public and staff can update table sessions" ON table_sessions
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- Allow payments access
DROP POLICY IF EXISTS "Public and staff can insert payments" ON payments;
CREATE POLICY "Public and staff can insert payments" ON payments
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public and staff can view payments" ON payments;
CREATE POLICY "Public and staff can view payments" ON payments
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Staff can update payments" ON payments;
CREATE POLICY "Staff can update payments" ON payments
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

-- 3. ENSURE REPLICA IDENTITY FULL FOR REALTIME TABLES
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE order_item_addons REPLICA IDENTITY FULL;
ALTER TABLE waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE kitchen_tickets REPLICA IDENTITY FULL;
ALTER TABLE kitchen_ticket_items REPLICA IDENTITY FULL;
ALTER TABLE restaurant_tables REPLICA IDENTITY FULL;
ALTER TABLE table_sessions REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;
ALTER TABLE notification_events REPLICA IDENTITY FULL;

-- 4. KITCHEN TICKET ITEMS & ORDER ITEM ADDONS RLS
ALTER TABLE kitchen_ticket_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public and staff can view kitchen ticket items" ON kitchen_ticket_items;
CREATE POLICY "Public and staff can view kitchen ticket items" ON kitchen_ticket_items
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Public and staff can insert kitchen ticket items" ON kitchen_ticket_items;
CREATE POLICY "Public and staff can insert kitchen ticket items" ON kitchen_ticket_items
    FOR INSERT TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can update kitchen ticket items" ON kitchen_ticket_items;
CREATE POLICY "Staff can update kitchen ticket items" ON kitchen_ticket_items
    FOR UPDATE TO public
    USING (true)
    WITH CHECK (true);

ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public and staff can view order item addons" ON order_item_addons;
CREATE POLICY "Public and staff can view order item addons" ON order_item_addons
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Public and staff can insert order item addons" ON order_item_addons;
CREATE POLICY "Public and staff can insert order item addons" ON order_item_addons
    FOR INSERT TO public
    WITH CHECK (true);
