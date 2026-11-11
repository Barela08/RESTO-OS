-- ====================================================================
-- RESTO OS - PostgreSQL Migration: 000003_functions_and_triggers.sql
-- Stored Procedures, Atomic Triggers & Daily QR Cryptographic Functions
-- ====================================================================

-- 1. DAILY QR GENERATION FUNCTION
CREATE OR REPLACE FUNCTION generate_daily_qr_tokens(p_restaurant_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
    v_table RECORD;
    v_today DATE := CURRENT_DATE;
    v_expires_at TIMESTAMPTZ := (CURRENT_DATE + TIME '23:59:59') AT TIME ZONE 'Asia/Kolkata';
    v_count INT := 0;
    v_token_hash VARCHAR;
BEGIN
    FOR v_table IN
        SELECT id, table_number
        FROM restaurant_tables
        WHERE restaurant_id = p_restaurant_id AND is_active = TRUE
    LOOP
        -- Check if token already exists for this table and date
        IF NOT EXISTS (
            SELECT 1 FROM table_qr_tokens
            WHERE table_id = v_table.id AND valid_date = v_today AND is_revoked = FALSE
        ) THEN
            -- Generate cryptographically random hash
            v_token_hash := encode(digest(p_restaurant_id || '-' || v_table.id || '-' || v_today::text || '-' || gen_random_uuid()::text, 'sha256'), 'hex');

            INSERT INTO table_qr_tokens (
                restaurant_id,
                table_id,
                token_hash,
                valid_date,
                expires_at
            ) VALUES (
                p_restaurant_id,
                v_table.id,
                v_token_hash,
                v_today,
                v_expires_at
            );

            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- Record in generation logs
    INSERT INTO qr_generation_logs (
        restaurant_id,
        generation_date,
        total_tables_processed,
        successful_tokens_created,
        status
    ) VALUES (
        p_restaurant_id,
        v_today,
        v_count,
        v_count,
        'COMPLETED'
    );

    RETURN jsonb_build_object(
        'success', true,
        'date', v_today,
        'tokens_generated', v_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. VERIFY QR TOKEN & MANAGE TABLE SESSION
CREATE OR REPLACE FUNCTION verify_table_qr_token(
    p_token_hash VARCHAR,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_token RECORD;
    v_table RECORD;
    v_active_session RECORD;
    v_new_session_token VARCHAR;
    v_new_session_id UUID;
    v_repeat_req_id UUID;
BEGIN
    -- 1. Find token
    SELECT * INTO v_token
    FROM table_qr_tokens
    WHERE token_hash = p_token_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TOKEN', 'message', 'QR code is not recognized.');
    END IF;

    -- 2. Check if revoked
    IF v_token.is_revoked THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'REVOKED_TOKEN', 'message', 'This QR code has been revoked by management.');
    END IF;

    -- 3. Check if expired
    IF NOW() > v_token.expires_at OR v_token.valid_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'EXPIRED_TOKEN', 'message', 'This daily QR code expired at midnight. Please ask staff for today’s code.');
    END IF;

    -- 4. Get Table Details
    SELECT * INTO v_table
    FROM restaurant_tables
    WHERE id = v_token.table_id;

    -- 5. Check if an active session exists on this table
    SELECT * INTO v_active_session
    FROM table_sessions
    WHERE table_id = v_table.id AND status = 'ACTIVE'
    ORDER BY opened_at DESC LIMIT 1;

    IF FOUND THEN
        -- Repeat scan detected! Create repeat_scan_request for cash counter
        INSERT INTO repeat_scan_requests (
            restaurant_id,
            table_id,
            existing_session_id,
            status,
            customer_identifier
        ) VALUES (
            v_table.restaurant_id,
            v_table.id,
            v_active_session.id,
            'PENDING',
            COALESCE(p_ip_address, 'Mobile Device')
        ) RETURNING id INTO v_repeat_req_id;

        -- Create notification for counter
        INSERT INTO notifications (
            restaurant_id,
            recipient_role,
            title,
            message,
            event_type,
            reference_id,
            sound_type
        ) VALUES (
            v_table.restaurant_id,
            'counter',
            'Repeat QR Scan at Table ' || v_table.table_number,
            'A repeat scan was detected on Table ' || v_table.table_number || '. Approval required.',
            'REPEAT_SCAN',
            v_repeat_req_id::text,
            'ALERT'
        );

        -- Log the scan
        INSERT INTO qr_scan_logs (
            restaurant_id, table_id, qr_token_id, session_id, ip_address, user_agent, is_repeat_scan, scan_status
        ) VALUES (
            v_table.restaurant_id, v_table.id, v_token.id, v_active_session.id, p_ip_address, p_user_agent, TRUE, 'REPEAT_PENDING'
        );

        RETURN jsonb_build_object(
            'success', true,
            'is_repeat_scan', true,
            'repeat_request_id', v_repeat_req_id,
            'table_number', v_table.table_number,
            'restaurant_id', v_table.restaurant_id,
            'existing_session_token', v_active_session.session_token,
            'message', 'Repeat scan detected. Awaiting Cash Counter approval or continuation.'
        );
    ELSE
        -- First scan of the session: create fresh session
        v_new_session_token := encode(digest(gen_random_uuid()::text || '-' || v_table.id, 'sha256'), 'hex');

        INSERT INTO table_sessions (
            restaurant_id,
            table_id,
            qr_token_id,
            session_token,
            status
        ) VALUES (
            v_table.restaurant_id,
            v_table.id,
            v_token.id,
            v_new_session_token,
            'ACTIVE'
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
            'session_id', v_new_session_id,
            'session_token', v_new_session_token,
            'table_id', v_table.id,
            'table_number', v_table.table_number,
            'seating_capacity', v_table.seating_capacity,
            'floor_area', v_table.floor_area,
            'restaurant_id', v_table.restaurant_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. CONFIRM CASH PAYMENT & ISSUE STAMP ATOMIC PROCEDURE
CREATE OR REPLACE FUNCTION confirm_cash_payment(
    p_payment_id UUID,
    p_staff_id UUID,
    p_cash_received NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_order RECORD;
    v_session RECORD;
    v_table RECORD;
    v_change NUMERIC;
    v_invoice_num VARCHAR;
    v_invoice_id UUID;
    v_customer RECORD;
    v_loyalty RECORD;
    v_stamp_awarded BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Payment record not found');
    END IF;

    IF v_payment.payment_status = 'PAID' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Payment has already been marked as PAID');
    END IF;

    IF p_cash_received < v_payment.amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Received amount is less than the bill total');
    END IF;

    v_change := p_cash_received - v_payment.amount;

    -- Update payment
    UPDATE payments
    SET payment_status = 'PAID',
        cash_received_amount = p_cash_received,
        cash_change_amount = v_change,
        confirmed_by_staff_id = p_staff_id,
        confirmed_at = NOW(),
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- Update related orders
    IF v_payment.order_id IS NOT NULL THEN
        UPDATE orders
        SET status = 'COMPLETED', updated_at = NOW()
        WHERE id = v_payment.order_id;
    ELSE
        -- Multiple orders in session
        UPDATE orders
        SET status = 'COMPLETED', updated_at = NOW()
        WHERE table_session_id = v_payment.table_session_id;
    END IF;

    -- Mark Table status for cleaning or available
    UPDATE restaurant_tables
    SET status = 'CLEANING', updated_at = NOW()
    WHERE id = v_payment.table_id;

    -- Close table session
    UPDATE table_sessions
    SET status = 'CLOSED', closed_at = NOW(), updated_at = NOW()
    WHERE id = v_payment.table_session_id;

    -- Generate Invoice
    v_invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 6);

    INSERT INTO invoices (
        restaurant_id,
        invoice_number,
        payment_id,
        table_session_id,
        table_id,
        order_id,
        subtotal_amount,
        cgst_rate,
        cgst_amount,
        sgst_rate,
        sgst_amount,
        total_amount,
        payment_method,
        transaction_ref
    ) VALUES (
        v_payment.restaurant_id,
        v_invoice_num,
        v_payment.id,
        v_payment.table_session_id,
        v_payment.table_id,
        v_payment.order_id,
        v_payment.amount / 1.05, -- base
        2.5,
        (v_payment.amount / 1.05) * 0.025,
        2.5,
        (v_payment.amount / 1.05) * 0.025,
        v_payment.amount,
        'CASH',
        'CASH-COUNTER-' || p_staff_id::text
    ) RETURNING id INTO v_invoice_id;

    -- CHECK FOR LOYALTY STAMP
    IF v_payment.order_id IS NOT NULL THEN
        SELECT * INTO v_order FROM orders WHERE id = v_payment.order_id;
        IF v_order.customer_phone IS NOT NULL AND v_order.customer_phone <> '' THEN
            SELECT * INTO v_customer FROM customers WHERE phone = v_order.customer_phone AND restaurant_id = v_payment.restaurant_id;
            IF FOUND THEN
                SELECT * INTO v_loyalty FROM loyalty_accounts WHERE customer_id = v_customer.id;
                IF FOUND AND NOT EXISTS (SELECT 1 FROM loyalty_stamps WHERE order_id = v_order.id) THEN
                    -- Award 1 stamp
                    INSERT INTO loyalty_stamps (
                        restaurant_id, loyalty_account_id, order_id, payment_id, stamps_awarded, order_amount
                    ) VALUES (
                        v_payment.restaurant_id, v_loyalty.id, v_order.id, v_payment.id, 1, v_payment.amount
                    );

                    UPDATE loyalty_accounts
                    SET total_stamps_earned = total_stamps_earned + 1,
                        current_active_stamps = current_active_stamps + 1,
                        updated_at = NOW()
                    WHERE id = v_loyalty.id;

                    v_stamp_awarded := TRUE;

                    -- Check if 8 stamps reached
                    IF (v_loyalty.current_active_stamps + 1) >= 8 THEN
                        INSERT INTO loyalty_rewards (
                            restaurant_id,
                            loyalty_account_id,
                            voucher_code,
                            title,
                            description,
                            expires_at
                        ) VALUES (
                            v_payment.restaurant_id,
                            v_loyalty.id,
                            'RW-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
                            'Complimentary Chef Special Delight',
                            'Earned after 8 completed orders at Resto OS',
                            NOW() + INTERVAL '30 days'
                        );

                        UPDATE loyalty_accounts
                        SET current_active_stamps = (current_active_stamps + 1) - 8,
                            total_rewards_unlocked = total_rewards_unlocked + 1
                        WHERE id = v_loyalty.id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_num,
        'change_amount', v_change,
        'stamp_awarded', v_stamp_awarded
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
