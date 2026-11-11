-- ====================================================================
-- RESTO OS - PostgreSQL Schema Migration: 000006_realtime_sync_and_table_billing.sql
-- Modules: Realtime CDC Replication, Table Card Aggregation, 
-- Atomic Bill Settlement, Table Reset & Role-Based Financial Access Control
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. REALTIME CDC PUBLICATION REPLICATION
-- --------------------------------------------------------------------
-- Enable full replica identity for realtime CDC broadcast across tables
ALTER TABLE restaurant_tables REPLICA IDENTITY FULL;
ALTER TABLE table_sessions REPLICA IDENTITY FULL;
ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE payments REPLICA IDENTITY FULL;
ALTER TABLE invoices REPLICA IDENTITY FULL;
ALTER TABLE waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE payment_verification_requests REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication safely
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables, table_sessions, orders, order_items, payments, invoices, waiter_calls;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

-- --------------------------------------------------------------------
-- 2. TABLE-WISE DAILY COLLECTION AGGREGATION RPC
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_table_daily_collection_summary(
    p_restaurant_id VARCHAR,
    p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    table_id UUID,
    table_number VARCHAR,
    seating_capacity INT,
    current_status VARCHAR,
    today_orders_count BIGINT,
    completed_bills_count BIGINT,
    total_billed_amount NUMERIC(12,2),
    cash_collection NUMERIC(12,2),
    upi_collection NUMERIC(12,2),
    pending_amount NUMERIC(12,2),
    last_transaction_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id AS table_id,
        rt.table_number,
        rt.seating_capacity,
        rt.status::VARCHAR AS current_status,
        COALESCE(ord_agg.order_count, 0)::BIGINT AS today_orders_count,
        COALESCE(inv_agg.bills_count, 0)::BIGINT AS completed_bills_count,
        COALESCE(inv_agg.total_billed, 0.00)::NUMERIC(12,2) AS total_billed_amount,
        COALESCE(inv_agg.cash_total, 0.00)::NUMERIC(12,2) AS cash_collection,
        COALESCE(inv_agg.upi_total, 0.00)::NUMERIC(12,2) AS upi_collection,
        COALESCE(pay_pending.pending_total, 0.00)::NUMERIC(12,2) AS pending_amount,
        inv_agg.last_txn AS last_transaction_time
    FROM restaurant_tables rt
    LEFT JOIN (
        SELECT 
            table_id,
            COUNT(id) AS order_count
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND DATE(created_at) = p_target_date
          AND status NOT IN ('CANCELLED', 'REJECTED')
        GROUP BY table_id
    ) ord_agg ON ord_agg.table_id = rt.id
    LEFT JOIN (
        SELECT 
            table_id,
            COUNT(id) AS bills_count,
            SUM(total_amount) AS total_billed,
            SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END) AS cash_total,
            SUM(CASE WHEN payment_method = 'UPI' THEN total_amount ELSE 0 END) AS upi_total,
            MAX(issued_at) AS last_txn
        FROM invoices
        WHERE restaurant_id = p_restaurant_id
          AND DATE(issued_at) = p_target_date
        GROUP BY table_id
    ) inv_agg ON inv_agg.table_id = rt.id
    LEFT JOIN (
        SELECT 
            table_id,
            SUM(amount) AS pending_total
        FROM payments
        WHERE restaurant_id = p_restaurant_id
          AND DATE(created_at) = p_target_date
          AND payment_status = 'PENDING'
        GROUP BY table_id
    ) pay_pending ON pay_pending.table_id = rt.id
    WHERE rt.restaurant_id = p_restaurant_id
    ORDER BY rt.table_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- 3. ATOMIC BILL SETTLEMENT & TABLE RESET TRANSACTION
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION settle_table_bill_and_close_session(
    p_restaurant_id VARCHAR,
    p_payment_id UUID,
    p_staff_id UUID,
    p_cash_received NUMERIC(10,2) DEFAULT NULL,
    p_transaction_ref VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_session RECORD;
    v_table RECORD;
    v_invoice_id UUID;
    v_invoice_number VARCHAR;
    v_cgst_rate NUMERIC(5,2);
    v_sgst_rate NUMERIC(5,2);
    v_taxable_subtotal NUMERIC(10,2);
    v_cgst_amount NUMERIC(10,2);
    v_sgst_amount NUMERIC(10,2);
    v_customer RECORD;
    v_stamp_awarded BOOLEAN := FALSE;
BEGIN
    -- 1. Fetch payment
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'PAYMENT_NOT_FOUND', 'message', 'Payment record not found.');
    END IF;

    IF v_payment.payment_status = 'PAID' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_PAID', 'message', 'Payment has already been settled.');
    END IF;

    -- 2. Fetch session and table
    SELECT * INTO v_session
    FROM table_sessions
    WHERE id = v_payment.table_session_id
    FOR UPDATE;

    SELECT * INTO v_table
    FROM restaurant_tables
    WHERE id = v_payment.table_id
    FOR UPDATE;

    -- 3. Fetch tax rates
    SELECT cgst_rate, sgst_rate INTO v_cgst_rate, v_sgst_rate
    FROM restaurant_settings
    WHERE restaurant_id = p_restaurant_id;

    IF v_cgst_rate IS NULL THEN v_cgst_rate := 2.50; END IF;
    IF v_sgst_rate IS NULL THEN v_sgst_rate := 2.50; END IF;

    -- 4. Mark payment as PAID
    UPDATE payments
    SET payment_status = 'PAID',
        confirmed_by_staff_id = p_staff_id,
        confirmed_at = NOW(),
        cash_received_amount = CASE WHEN v_payment.payment_method = 'CASH' THEN p_cash_received ELSE NULL END,
        cash_change_amount = CASE WHEN v_payment.payment_method = 'CASH' AND p_cash_received IS NOT NULL THEN (p_cash_received - v_payment.amount) ELSE NULL END,
        transaction_ref = COALESCE(p_transaction_ref, v_payment.transaction_ref, 'CASH-SETTLE')
    WHERE id = v_payment.id;

    -- 5. Mark all orders in this table session as COMPLETED
    UPDATE orders
    SET status = 'COMPLETED',
        updated_at = NOW()
    WHERE table_session_id = v_session.id
      AND status NOT IN ('CANCELLED', 'REJECTED');

    -- 6. Close the active session
    UPDATE table_sessions
    SET status = 'CLOSED',
        closed_at = NOW()
    WHERE id = v_session.id;

    -- 7. Transition table status to CLEANING
    UPDATE restaurant_tables
    SET status = 'CLEANING',
        updated_at = NOW()
    WHERE id = v_table.id;

    -- 8. Generate Official Tax Invoice
    v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
    v_taxable_subtotal := ROUND(v_payment.amount / 1.05, 2);
    v_cgst_amount := ROUND(v_taxable_subtotal * (v_cgst_rate / 100.0), 2);
    v_sgst_amount := ROUND(v_taxable_subtotal * (v_sgst_rate / 100.0), 2);

    INSERT INTO invoices (
        restaurant_id,
        invoice_number,
        payment_id,
        table_session_id,
        table_id,
        order_id,
        customer_name,
        customer_phone,
        subtotal_amount,
        cgst_rate,
        cgst_amount,
        sgst_rate,
        sgst_amount,
        service_charge_amount,
        discount_amount,
        total_amount,
        payment_method,
        transaction_ref,
        issued_at
    ) VALUES (
        p_restaurant_id,
        v_invoice_number,
        v_payment.id,
        v_session.id,
        v_table.id,
        v_payment.order_id,
        COALESCE(v_session.customer_name, 'Guest Customer'),
        v_session.customer_phone,
        v_taxable_subtotal,
        v_cgst_rate,
        v_cgst_amount,
        v_sgst_rate,
        v_sgst_amount,
        0.00,
        0.00,
        v_payment.amount,
        v_payment.payment_method,
        COALESCE(p_transaction_ref, v_payment.transaction_ref, 'OFFICIAL-TXN'),
        NOW()
    ) RETURNING id INTO v_invoice_id;

    -- 9. Evaluate digital loyalty stamp for registered customer
    IF v_session.customer_phone IS NOT NULL THEN
        SELECT * INTO v_customer
        FROM customers
        WHERE phone = v_session.customer_phone AND restaurant_id = p_restaurant_id;

        IF FOUND THEN
            UPDATE loyalty_accounts
            SET total_stamps_earned = total_stamps_earned + 1,
                current_active_stamps = current_active_stamps + 1
            WHERE customer_id = v_customer.id AND restaurant_id = p_restaurant_id;
            v_stamp_awarded := TRUE;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'amount', v_payment.amount,
        'table_number', v_table.table_number,
        'session_id', v_session.id,
        'table_status', 'CLEANING',
        'stamp_awarded', v_stamp_awarded,
        'message', 'Bill successfully settled. Invoice generated and table queued for cleaning.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- 4. TABLE CLEANING COMPLETION RPC
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_table_cleaned(
    p_restaurant_id VARCHAR,
    p_table_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_table RECORD;
BEGIN
    SELECT * INTO v_table
    FROM restaurant_tables
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND', 'message', 'Table not found.');
    END IF;

    UPDATE restaurant_tables
    SET status = 'AVAILABLE',
        updated_at = NOW()
    WHERE id = p_table_id;

    RETURN jsonb_build_object(
        'success', true,
        'table_id', p_table_id,
        'table_number', v_table.table_number,
        'status', 'AVAILABLE',
        'message', 'Table ' || v_table.table_number || ' is now clean and available for next guest.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------
-- 5. GRANULAR RLS POLICIES FOR INVOICES & FINANCIAL RECORDS
-- --------------------------------------------------------------------
-- Drop existing broad invoice policies if needed
DROP POLICY IF EXISTS "Public can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Counter and Admin can manage invoices" ON invoices;

-- Admin and Cash Counter have full financial visibility
CREATE POLICY "Cash Counter and Admin full access to invoices"
ON invoices FOR ALL
USING (get_current_user_role() IN ('counter', 'admin', 'owner'));

-- Waiters and Kitchen are strictly denied direct invoice queries
-- (Policy ensures only role matching or explicit phone match is accepted)
CREATE POLICY "Customers view only their verified invoices"
ON invoices FOR SELECT
USING (
    get_current_user_role() IN ('counter', 'admin', 'owner')
    OR (
        customer_phone IS NOT NULL 
        AND customer_phone = NULLIF(current_setting('request.jwt.claim.phone', true), '')
    )
    OR (
        table_session_id IS NOT NULL 
        AND table_session_id::TEXT = NULLIF(current_setting('request.jwt.claim.session_id', true), '')
    )
);
