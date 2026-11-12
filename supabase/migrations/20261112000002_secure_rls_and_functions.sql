-- ====================================================================
-- RESTO OS: Complete Production RLS Remediation & Function Hardening
-- Migration: 20261112000002_secure_rls_and_functions.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. SECURE SEARCH_PATH & SECURITY DEFINER HELPERS
-- --------------------------------------------------------------------

-- Clean up legacy outdated function signatures
DROP FUNCTION IF EXISTS public.confirm_cash_payment(uuid, uuid, numeric, text);
DROP FUNCTION IF EXISTS public.settle_table_bill_and_close_session(character varying, uuid, uuid, numeric, character varying);

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS character varying
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role_id 
    FROM profiles 
    WHERE id = auth.uid() AND is_active = true 
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_restaurant_id()
RETURNS character varying
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT restaurant_id 
    FROM profiles 
    WHERE id = auth.uid() AND is_active = true 
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_member(p_restaurant_id character varying)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
          AND restaurant_id = p_restaurant_id 
          AND is_active = true
    );
$$;

-- --------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY ON ALL 23 PREVIOUSLY UNPROTECTED TABLES
-- --------------------------------------------------------------------

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_assignments ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 3. REMOVE LOOSE AND PERMISSIVE SHORTCUT POLICIES
-- --------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff and Admin full access to staff" ON staff;
DROP POLICY IF EXISTS "Public can view on duty staff" ON staff;
DROP POLICY IF EXISTS "Public and staff can view orders" ON orders;
DROP POLICY IF EXISTS "Public and staff can insert orders" ON orders;
DROP POLICY IF EXISTS "Public and staff can update orders" ON orders;
DROP POLICY IF EXISTS "Staff can update orders" ON orders;
DROP POLICY IF EXISTS "Public can view own orders" ON orders;
DROP POLICY IF EXISTS "Public can insert orders" ON orders;
DROP POLICY IF EXISTS "Waiter can update orders" ON orders;

DROP POLICY IF EXISTS "Public and staff can view order items" ON order_items;
DROP POLICY IF EXISTS "Public and staff can insert order items" ON order_items;
DROP POLICY IF EXISTS "Public can view order items" ON order_items;
DROP POLICY IF EXISTS "Public can insert order items" ON order_items;

DROP POLICY IF EXISTS "Public and staff can view payments" ON payments;
DROP POLICY IF EXISTS "Public and staff can insert payments" ON payments;
DROP POLICY IF EXISTS "Staff can update payments" ON payments;
DROP POLICY IF EXISTS "Counter and Admin can manage payments" ON payments;

DROP POLICY IF EXISTS "Public and staff can view table sessions" ON table_sessions;
DROP POLICY IF EXISTS "Public and staff can update table sessions" ON table_sessions;
DROP POLICY IF EXISTS "Public can view own table session" ON table_sessions;
DROP POLICY IF EXISTS "Public can create table sessions" ON table_sessions;

DROP POLICY IF EXISTS "Public and staff can view waiter calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public and staff can insert waiter calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public can create waiter calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public can view waiter calls" ON waiter_calls;
DROP POLICY IF EXISTS "Staff can update waiter calls" ON waiter_calls;
DROP POLICY IF EXISTS "Staff can view and update waiter calls" ON waiter_calls;

DROP POLICY IF EXISTS "Public and staff can view kitchen tickets" ON kitchen_tickets;
DROP POLICY IF EXISTS "Public and staff can insert kitchen tickets" ON kitchen_tickets;
DROP POLICY IF EXISTS "Staff can update kitchen tickets" ON kitchen_tickets;
DROP POLICY IF EXISTS "Kitchen and Admin can view and update tickets" ON kitchen_tickets;

-- --------------------------------------------------------------------
-- 4. IMPLEMENT STRICT RESTAURANT-ISOLATED & ROLE-BASED POLICIES
-- --------------------------------------------------------------------

-- A. STAFF & PROFILES
DROP POLICY IF EXISTS "staff_read_restaurant_scoped" ON staff;
CREATE POLICY "staff_read_restaurant_scoped" ON staff
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "staff_manage_admin_owner" ON staff;
CREATE POLICY "staff_manage_admin_owner" ON staff
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    );

DROP POLICY IF EXISTS "public_view_onduty_waiters" ON staff;
CREATE POLICY "public_view_onduty_waiters" ON staff
    FOR SELECT TO anon
    USING (is_on_duty = true);

-- B. STAFF ROLES & PERMISSIONS
DROP POLICY IF EXISTS "staff_roles_public_read" ON staff_roles;
CREATE POLICY "staff_roles_public_read" ON staff_roles
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "staff_roles_admin_manage" ON staff_roles;
CREATE POLICY "staff_roles_admin_manage" ON staff_roles
    FOR ALL TO authenticated
    USING (get_current_user_role() IN ('admin', 'owner'))
    WITH CHECK (get_current_user_role() IN ('admin', 'owner'));

DROP POLICY IF EXISTS "role_permissions_staff_read" ON role_permissions;
CREATE POLICY "role_permissions_staff_read" ON role_permissions
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "role_permissions_admin_manage" ON role_permissions;
CREATE POLICY "role_permissions_admin_manage" ON role_permissions
    FOR ALL TO authenticated
    USING (get_current_user_role() IN ('admin', 'owner'))
    WITH CHECK (get_current_user_role() IN ('admin', 'owner'));

-- C. CUSTOMERS & OTP & RATE LIMITS
DROP POLICY IF EXISTS "customers_staff_read" ON customers;
CREATE POLICY "customers_staff_read" ON customers
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "customers_staff_manage" ON customers;
CREATE POLICY "customers_staff_manage" ON customers
    FOR ALL TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id())
    WITH CHECK (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "customers_guest_self_register" ON customers;
CREATE POLICY "customers_guest_self_register" ON customers
    FOR INSERT TO anon
    WITH CHECK (phone IS NOT NULL AND length(phone) >= 10);

DROP POLICY IF EXISTS "customers_guest_self_read" ON customers;
CREATE POLICY "customers_guest_self_read" ON customers
    FOR SELECT TO anon
    USING (phone = current_setting('request.headers', true)::json->>'x-customer-phone');

-- Customer OTP codes: Strictly Service Role / Edge Functions only!
DROP POLICY IF EXISTS "customer_otp_service_only" ON customer_otp_codes;
CREATE POLICY "customer_otp_service_only" ON customer_otp_codes
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Login rate limits: Strictly Service Role / Edge Functions only!
DROP POLICY IF EXISTS "login_rate_limits_service_only" ON login_rate_limits;
CREATE POLICY "login_rate_limits_service_only" ON login_rate_limits
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- D. TABLE SESSIONS & RESTAURANT TABLES
DROP POLICY IF EXISTS "table_sessions_staff_read" ON table_sessions;
CREATE POLICY "table_sessions_staff_read" ON table_sessions
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "table_sessions_staff_update" ON table_sessions;
CREATE POLICY "table_sessions_staff_update" ON table_sessions
    FOR UPDATE TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id())
    WITH CHECK (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "table_sessions_guest_read" ON table_sessions;
CREATE POLICY "table_sessions_guest_read" ON table_sessions
    FOR SELECT TO anon
    USING (
        status = 'ACTIVE' 
        AND session_token = current_setting('request.headers', true)::json->>'x-session-token'
    );

DROP POLICY IF EXISTS "table_sessions_guest_update" ON table_sessions;
CREATE POLICY "table_sessions_guest_update" ON table_sessions
    FOR UPDATE TO anon
    USING (
        status = 'ACTIVE' 
        AND session_token = current_setting('request.headers', true)::json->>'x-session-token'
    )
    WITH CHECK (
        restaurant_id IS NOT NULL 
        AND table_id IS NOT NULL
    );

-- E. ORDERS & ORDER ITEMS
DROP POLICY IF EXISTS "orders_staff_read" ON orders;
CREATE POLICY "orders_staff_read" ON orders
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "orders_staff_update" ON orders;
CREATE POLICY "orders_staff_update" ON orders
    FOR UPDATE TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner', 'waiter', 'counter', 'kitchen')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
    );

DROP POLICY IF EXISTS "orders_guest_create" ON orders;
CREATE POLICY "orders_guest_create" ON orders
    FOR INSERT TO anon
    WITH CHECK (
        restaurant_id IS NOT NULL 
        AND table_id IS NOT NULL
        AND total_amount >= 0
    );

DROP POLICY IF EXISTS "orders_guest_read" ON orders;
CREATE POLICY "orders_guest_read" ON orders
    FOR SELECT TO anon
    USING (
        table_session_id IN (
            SELECT id FROM table_sessions 
            WHERE status = 'ACTIVE' 
              AND session_token = current_setting('request.headers', true)::json->>'x-session-token'
        )
    );

DROP POLICY IF EXISTS "order_items_staff_read" ON order_items;
CREATE POLICY "order_items_staff_read" ON order_items
    FOR SELECT TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
    );

DROP POLICY IF EXISTS "order_items_staff_update" ON order_items;
CREATE POLICY "order_items_staff_update" ON order_items
    FOR UPDATE TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
    );

DROP POLICY IF EXISTS "order_items_guest_create" ON order_items;
CREATE POLICY "order_items_guest_create" ON order_items
    FOR INSERT TO anon
    WITH CHECK (order_id IS NOT NULL AND quantity > 0);

DROP POLICY IF EXISTS "order_items_guest_read" ON order_items;
CREATE POLICY "order_items_guest_read" ON order_items
    FOR SELECT TO anon
    USING (
        order_id IN (
            SELECT o.id FROM orders o
            JOIN table_sessions ts ON ts.id = o.table_session_id
            WHERE ts.status = 'ACTIVE' 
              AND ts.session_token = current_setting('request.headers', true)::json->>'x-session-token'
        )
    );

-- F. ORDER ITEM ADDONS & MENU ITEM ADDONS
DROP POLICY IF EXISTS "menu_item_addons_public_read" ON menu_item_addons;
CREATE POLICY "menu_item_addons_public_read" ON menu_item_addons
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "menu_item_addons_admin_manage" ON menu_item_addons;
CREATE POLICY "menu_item_addons_admin_manage" ON menu_item_addons
    FOR ALL TO authenticated
    USING (get_current_user_role() IN ('admin', 'owner'))
    WITH CHECK (get_current_user_role() IN ('admin', 'owner'));

DROP POLICY IF EXISTS "order_item_addons_staff_read" ON order_item_addons;
CREATE POLICY "order_item_addons_staff_read" ON order_item_addons
    FOR SELECT TO authenticated
    USING (
        order_item_id IN (
            SELECT oi.id FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.restaurant_id = get_current_user_restaurant_id()
        )
    );

DROP POLICY IF EXISTS "order_item_addons_guest_create" ON order_item_addons;
CREATE POLICY "order_item_addons_guest_create" ON order_item_addons
    FOR INSERT TO anon
    WITH CHECK (order_item_id IS NOT NULL);

DROP POLICY IF EXISTS "order_item_addons_guest_read" ON order_item_addons;
CREATE POLICY "order_item_addons_guest_read" ON order_item_addons
    FOR SELECT TO anon
    USING (
        order_item_id IN (
            SELECT oi.id FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN table_sessions ts ON ts.id = o.table_session_id
            WHERE ts.session_token = current_setting('request.headers', true)::json->>'x-session-token'
        )
    );

-- G. ORDER STATUS HISTORY
DROP POLICY IF EXISTS "order_status_history_staff_read" ON order_status_history;
CREATE POLICY "order_status_history_staff_read" ON order_status_history
    FOR SELECT TO authenticated
    USING (
        order_id IN (
            SELECT id FROM orders 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
    );

DROP POLICY IF EXISTS "order_status_history_staff_insert" ON order_status_history;
CREATE POLICY "order_status_history_staff_insert" ON order_status_history
    FOR INSERT TO authenticated
    WITH CHECK (
        order_id IN (
            SELECT id FROM orders 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
    );

-- H. KITCHEN STATIONS & KITCHEN TICKETS & TICKET ITEMS
DROP POLICY IF EXISTS "kitchen_stations_staff_read" ON kitchen_stations;
CREATE POLICY "kitchen_stations_staff_read" ON kitchen_stations
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "kitchen_stations_admin_manage" ON kitchen_stations;
CREATE POLICY "kitchen_stations_admin_manage" ON kitchen_stations
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    );

DROP POLICY IF EXISTS "kitchen_tickets_staff_read" ON kitchen_tickets;
CREATE POLICY "kitchen_tickets_staff_read" ON kitchen_tickets
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "kitchen_tickets_staff_update" ON kitchen_tickets;
CREATE POLICY "kitchen_tickets_staff_update" ON kitchen_tickets
    FOR UPDATE TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('kitchen', 'admin', 'owner', 'waiter')
    )
    WITH CHECK (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "kitchen_tickets_create" ON kitchen_tickets;
CREATE POLICY "kitchen_tickets_create" ON kitchen_tickets
    FOR INSERT TO public
    WITH CHECK (restaurant_id IS NOT NULL AND order_id IS NOT NULL);

DROP POLICY IF EXISTS "kitchen_ticket_items_staff_read" ON kitchen_ticket_items;
CREATE POLICY "kitchen_ticket_items_staff_read" ON kitchen_ticket_items
    FOR SELECT TO authenticated
    USING (
        kitchen_ticket_id IN (
            SELECT id FROM kitchen_tickets 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
    );

DROP POLICY IF EXISTS "kitchen_ticket_items_staff_update" ON kitchen_ticket_items;
CREATE POLICY "kitchen_ticket_items_staff_update" ON kitchen_ticket_items
    FOR UPDATE TO authenticated
    USING (
        kitchen_ticket_id IN (
            SELECT id FROM kitchen_tickets 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
        AND get_current_user_role() IN ('kitchen', 'admin', 'owner')
    );

DROP POLICY IF EXISTS "kitchen_ticket_items_create" ON kitchen_ticket_items;
CREATE POLICY "kitchen_ticket_items_create" ON kitchen_ticket_items
    FOR INSERT TO public
    WITH CHECK (kitchen_ticket_id IS NOT NULL AND order_item_id IS NOT NULL);

-- I. WAITER CALLS & WAITER ASSIGNMENTS
DROP POLICY IF EXISTS "waiter_calls_staff_read" ON waiter_calls;
CREATE POLICY "waiter_calls_staff_read" ON waiter_calls
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "waiter_calls_staff_update" ON waiter_calls;
CREATE POLICY "waiter_calls_staff_update" ON waiter_calls
    FOR UPDATE TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('waiter', 'counter', 'admin', 'owner')
    )
    WITH CHECK (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "waiter_calls_guest_create" ON waiter_calls;
CREATE POLICY "waiter_calls_guest_create" ON waiter_calls
    FOR INSERT TO anon
    WITH CHECK (restaurant_id IS NOT NULL AND table_id IS NOT NULL);

DROP POLICY IF EXISTS "waiter_calls_guest_read" ON waiter_calls;
CREATE POLICY "waiter_calls_guest_read" ON waiter_calls
    FOR SELECT TO anon
    USING (
        table_session_id IN (
            SELECT id FROM table_sessions 
            WHERE status = 'ACTIVE' 
              AND session_token = current_setting('request.headers', true)::json->>'x-session-token'
        )
    );

DROP POLICY IF EXISTS "waiter_assignments_staff_read" ON waiter_assignments;
CREATE POLICY "waiter_assignments_staff_read" ON waiter_assignments
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "waiter_assignments_staff_manage" ON waiter_assignments;
CREATE POLICY "waiter_assignments_staff_manage" ON waiter_assignments
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner', 'counter', 'waiter')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
    );

-- J. PAYMENTS & REFUNDS
DROP POLICY IF EXISTS "payments_staff_read" ON payments;
CREATE POLICY "payments_staff_read" ON payments
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "payments_counter_manage" ON payments;
CREATE POLICY "payments_counter_manage" ON payments
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('counter', 'admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
    );

DROP POLICY IF EXISTS "payments_guest_insert" ON payments;
CREATE POLICY "payments_guest_insert" ON payments
    FOR INSERT TO anon
    WITH CHECK (
        restaurant_id IS NOT NULL 
        AND table_session_id IS NOT NULL 
        AND amount > 0
    );

DROP POLICY IF EXISTS "payments_guest_read" ON payments;
CREATE POLICY "payments_guest_read" ON payments
    FOR SELECT TO anon
    USING (
        table_session_id IN (
            SELECT id FROM table_sessions 
            WHERE session_token = current_setting('request.headers', true)::json->>'x-session-token'
        )
    );

DROP POLICY IF EXISTS "refunds_staff_read" ON refunds;
CREATE POLICY "refunds_staff_read" ON refunds
    FOR SELECT TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('counter', 'admin', 'owner')
    );

DROP POLICY IF EXISTS "refunds_counter_manage" ON refunds;
CREATE POLICY "refunds_counter_manage" ON refunds
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('counter', 'admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('counter', 'admin', 'owner')
    );

DROP POLICY IF EXISTS "refunds_service_role" ON refunds;
CREATE POLICY "refunds_service_role" ON refunds
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- K. INVENTORY, SUPPLIERS & RECIPES
DROP POLICY IF EXISTS "inventory_movements_staff_read" ON inventory_movements;
CREATE POLICY "inventory_movements_staff_read" ON inventory_movements
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "inventory_movements_staff_insert" ON inventory_movements;
CREATE POLICY "inventory_movements_staff_insert" ON inventory_movements
    FOR INSERT TO authenticated
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('kitchen', 'counter', 'admin', 'owner')
    );

DROP POLICY IF EXISTS "suppliers_staff_read" ON suppliers;
CREATE POLICY "suppliers_staff_read" ON suppliers
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "suppliers_admin_manage" ON suppliers;
CREATE POLICY "suppliers_admin_manage" ON suppliers
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    );

DROP POLICY IF EXISTS "recipes_staff_read" ON recipes;
CREATE POLICY "recipes_staff_read" ON recipes
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "recipes_admin_manage" ON recipes;
CREATE POLICY "recipes_admin_manage" ON recipes
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    );

DROP POLICY IF EXISTS "recipe_ingredients_staff_read" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_staff_read" ON recipe_ingredients
    FOR SELECT TO authenticated
    USING (
        recipe_id IN (
            SELECT id FROM recipes 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
    );

DROP POLICY IF EXISTS "recipe_ingredients_admin_manage" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_admin_manage" ON recipe_ingredients
    FOR ALL TO authenticated
    USING (
        recipe_id IN (
            SELECT id FROM recipes 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
        AND get_current_user_role() IN ('admin', 'owner')
    )
    WITH CHECK (
        recipe_id IN (
            SELECT id FROM recipes 
            WHERE restaurant_id = get_current_user_restaurant_id()
        )
        AND get_current_user_role() IN ('admin', 'owner')
    );

-- L. LOYALTY STAMPS & REWARDS
DROP POLICY IF EXISTS "loyalty_stamps_staff_read" ON loyalty_stamps;
CREATE POLICY "loyalty_stamps_staff_read" ON loyalty_stamps
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "loyalty_stamps_staff_manage" ON loyalty_stamps;
CREATE POLICY "loyalty_stamps_staff_manage" ON loyalty_stamps
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('counter', 'admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
    );

DROP POLICY IF EXISTS "loyalty_rewards_staff_read" ON loyalty_rewards;
CREATE POLICY "loyalty_rewards_staff_read" ON loyalty_rewards
    FOR SELECT TO authenticated
    USING (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "loyalty_rewards_staff_manage" ON loyalty_rewards;
CREATE POLICY "loyalty_rewards_staff_manage" ON loyalty_rewards
    FOR ALL TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('counter', 'admin', 'owner')
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
    );

DROP POLICY IF EXISTS "loyalty_rewards_service_role" ON loyalty_rewards;
CREATE POLICY "loyalty_rewards_service_role" ON loyalty_rewards
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- M. NOTIFICATIONS & DELIVERY LOGS
DROP POLICY IF EXISTS "notifications_staff_read" ON notifications;
CREATE POLICY "notifications_staff_read" ON notifications
    FOR SELECT TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND (
            recipient_user_id = auth.uid() 
            OR recipient_role = get_current_user_role()
            OR recipient_role IS NULL
        )
    );

DROP POLICY IF EXISTS "notifications_staff_update" ON notifications;
CREATE POLICY "notifications_staff_update" ON notifications
    FOR UPDATE TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND (recipient_user_id = auth.uid() OR recipient_role = get_current_user_role())
    )
    WITH CHECK (
        restaurant_id = get_current_user_restaurant_id()
    );

DROP POLICY IF EXISTS "notifications_service_insert" ON notifications;
CREATE POLICY "notifications_service_insert" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "notification_delivery_logs_read" ON notification_delivery_logs;
CREATE POLICY "notification_delivery_logs_read" ON notification_delivery_logs
    FOR SELECT TO authenticated
    USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "notification_delivery_logs_insert" ON notification_delivery_logs;
CREATE POLICY "notification_delivery_logs_insert" ON notification_delivery_logs
    FOR INSERT TO authenticated
    WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "notification_delivery_logs_service" ON notification_delivery_logs;
CREATE POLICY "notification_delivery_logs_service" ON notification_delivery_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- N. QR LOGS & AUDIT LOGS
DROP POLICY IF EXISTS "qr_generation_logs_admin_read" ON qr_generation_logs;
CREATE POLICY "qr_generation_logs_admin_read" ON qr_generation_logs
    FOR SELECT TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    );

DROP POLICY IF EXISTS "qr_generation_logs_service" ON qr_generation_logs;
CREATE POLICY "qr_generation_logs_service" ON qr_generation_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "qr_scan_logs_staff_read" ON qr_scan_logs;
CREATE POLICY "qr_scan_logs_staff_read" ON qr_scan_logs
    FOR SELECT TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner', 'counter')
    );

DROP POLICY IF EXISTS "qr_scan_logs_service" ON qr_scan_logs;
CREATE POLICY "qr_scan_logs_service" ON qr_scan_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_admin_owner_view" ON audit_logs;
CREATE POLICY "audit_logs_admin_owner_view" ON audit_logs
    FOR SELECT TO authenticated
    USING (
        restaurant_id = get_current_user_restaurant_id()
        AND get_current_user_role() IN ('admin', 'owner')
    );

DROP POLICY IF EXISTS "audit_logs_staff_insert" ON audit_logs;
CREATE POLICY "audit_logs_staff_insert" ON audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (restaurant_id = get_current_user_restaurant_id());

DROP POLICY IF EXISTS "audit_logs_service" ON audit_logs;
CREATE POLICY "audit_logs_service" ON audit_logs
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- --------------------------------------------------------------------
-- 5. SECURE POSTGRESQL FUNCTIONS (SEARCH_PATH & CALLER VALIDATION)
-- --------------------------------------------------------------------

-- A. GENERATE PERMANENT TABLE QR
CREATE OR REPLACE FUNCTION public.generate_permanent_table_qr(
    p_restaurant_id character varying, 
    p_table_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role VARCHAR;
    v_caller_rest VARCHAR;
    v_table RECORD;
    v_existing_token RECORD;
    v_token_hash VARCHAR;
    v_token_id UUID;
BEGIN
    -- Verify authorization: only admin or owner of this restaurant
    SELECT role_id, restaurant_id INTO v_caller_role, v_caller_rest
    FROM profiles
    WHERE id = auth.uid() AND is_active = true;

    IF auth.role() <> 'service_role' AND (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'owner') OR v_caller_rest <> p_restaurant_id) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'FORBIDDEN', 
            'message', 'Only verified restaurant managers can generate permanent QR tokens.'
        );
    END IF;

    SELECT * INTO v_table
    FROM restaurant_tables
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND', 'message', 'Table does not exist.');
    END IF;

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
$$;

-- B. GENERATE DAILY QR TOKENS
CREATE OR REPLACE FUNCTION public.generate_daily_qr_tokens(
    p_restaurant_id character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role VARCHAR;
    v_caller_rest VARCHAR;
    v_table RECORD;
    v_today DATE := CURRENT_DATE;
    v_expires_at TIMESTAMPTZ := (CURRENT_DATE + TIME '23:59:59') AT TIME ZONE 'Asia/Kolkata';
    v_count INT := 0;
    v_token_hash VARCHAR;
BEGIN
    SELECT role_id, restaurant_id INTO v_caller_role, v_caller_rest
    FROM profiles
    WHERE id = auth.uid() AND is_active = true;

    IF auth.role() <> 'service_role' AND (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'owner') OR v_caller_rest <> p_restaurant_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized to generate daily QR tokens.');
    END IF;

    FOR v_table IN
        SELECT id, table_number
        FROM restaurant_tables
        WHERE restaurant_id = p_restaurant_id AND is_active = TRUE
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM table_qr_tokens
            WHERE table_id = v_table.id AND valid_date = v_today AND is_revoked = FALSE
        ) THEN
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
$$;

-- C. SERVER CALCULATE ORDER TOTALS
CREATE OR REPLACE FUNCTION public.server_calculate_order_totals(
    p_items jsonb, 
    p_cgst_rate numeric DEFAULT 2.50, 
    p_sgst_rate numeric DEFAULT 2.50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    v_validated_items JSONB := '[]'::jsonb;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'menu_item_id')::uuid;
        v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));

        SELECT base_price INTO v_base_price
        FROM menu_items
        WHERE id = v_item_id AND is_available = TRUE;

        IF NOT FOUND THEN
            CONTINUE;
        END IF;

        v_variant_delta := 0.00;
        IF v_item ? 'variant_id' AND v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' THEN
            v_variant_id := (v_item->>'variant_id')::uuid;
            SELECT COALESCE(price_adjustment, 0.00) INTO v_variant_delta
            FROM menu_variants
            WHERE id = v_variant_id AND menu_item_id = v_item_id;
        END IF;

        v_addons_total := 0.00;
        IF v_item ? 'addon_ids' AND jsonb_array_length(v_item->'addon_ids') > 0 THEN
            SELECT COALESCE(SUM(price), 0.00) INTO v_addons_total
            FROM menu_addons
            WHERE id IN (
                SELECT (jsonb_array_elements_text(v_item->'addon_ids'))::uuid
            ) AND is_available = TRUE;
        END IF;

        v_line_unit_price := GREATEST(0.00, v_base_price + v_variant_delta + v_addons_total);
        v_line_total := v_line_unit_price * v_qty;
        v_subtotal := v_subtotal + v_line_total;

        v_validated_items := v_validated_items || jsonb_build_object(
            'menu_item_id', v_item_id,
            'quantity', v_qty,
            'unit_price', v_line_unit_price,
            'line_total', v_line_total
        );
    END LOOP;

    v_cgst := ROUND((v_subtotal * (p_cgst_rate / 100.00)), 2);
    v_sgst := ROUND((v_subtotal * (p_sgst_rate / 100.00)), 2);
    v_total := v_subtotal + v_cgst + v_sgst;

    RETURN jsonb_build_object(
        'subtotal', v_subtotal,
        'cgst', v_cgst,
        'sgst', v_sgst,
        'total', v_total,
        'items', v_validated_items
    );
END;
$$;

-- D. GET TABLE DAILY COLLECTION SUMMARY
DROP FUNCTION IF EXISTS public.get_table_daily_collection_summary(character varying, date);
CREATE OR REPLACE FUNCTION public.get_table_daily_collection_summary(
    p_restaurant_id character varying, 
    p_target_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    table_id uuid, 
    table_number character varying, 
    floor_area character varying, 
    current_status character varying, 
    orders_count bigint, 
    total_ordered numeric, 
    bills_count bigint, 
    total_billed numeric, 
    cash_collected numeric, 
    upi_collected numeric, 
    pending_amount numeric, 
    last_transaction_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rt.id AS table_id,
        rt.table_number,
        rt.floor_area,
        rt.status AS current_status,
        COALESCE(ord_agg.orders_count, 0) AS orders_count,
        COALESCE(ord_agg.total_ordered, 0.00) AS total_ordered,
        COALESCE(inv_agg.bills_count, 0) AS bills_count,
        COALESCE(inv_agg.total_billed, 0.00) AS total_billed,
        COALESCE(inv_agg.cash_total, 0.00) AS cash_collected,
        COALESCE(inv_agg.upi_total, 0.00) AS upi_collected,
        COALESCE(pay_pending.pending_total, 0.00) AS pending_amount,
        inv_agg.last_txn AS last_transaction_at
    FROM restaurant_tables rt
    LEFT JOIN (
        SELECT 
            table_id,
            COUNT(id) AS orders_count,
            SUM(total_amount) AS total_ordered
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND DATE(created_at) = p_target_date
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
$$;

-- E. SETTLE TABLE BILL AND CLOSE SESSION
CREATE OR REPLACE FUNCTION public.settle_table_bill_and_close_session(
    p_restaurant_id character varying, 
    p_table_id uuid, 
    p_session_id uuid, 
    p_payment_method character varying, 
    p_transaction_ref character varying DEFAULT NULL::character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role VARCHAR;
    v_caller_id UUID := auth.uid();
    v_table RECORD;
    v_session RECORD;
    v_total_amount NUMERIC := 0.00;
    v_cgst NUMERIC := 0.00;
    v_sgst NUMERIC := 0.00;
    v_subtotal NUMERIC := 0.00;
    v_invoice_id UUID;
    v_invoice_num VARCHAR;
    v_payment_id UUID;
    v_customer RECORD;
    v_loyalty_account RECORD;
    v_stamp_awarded BOOLEAN := FALSE;
    v_order RECORD;
BEGIN
    -- Verify caller is authorized counter/admin/owner or service_role
    SELECT role_id INTO v_caller_role
    FROM profiles
    WHERE id = v_caller_id AND restaurant_id = p_restaurant_id AND is_active = true;

    IF auth.role() <> 'service_role' AND (v_caller_role IS NULL OR v_caller_role NOT IN ('counter', 'admin', 'owner')) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'FORBIDDEN', 
            'message', 'Only authorized Cashier or Admin can settle bills.'
        );
    END IF;

    SELECT * INTO v_table
    FROM restaurant_tables
    WHERE id = p_table_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND', 'message', 'Table not found.');
    END IF;

    SELECT * INTO v_session
    FROM table_sessions
    WHERE id = p_session_id AND table_id = p_table_id AND status = 'ACTIVE'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND', 'message', 'No active dining session found for this table.');
    END IF;

    SELECT 
        COALESCE(SUM(subtotal), 0.00),
        COALESCE(SUM(cgst_amount), 0.00),
        COALESCE(SUM(sgst_amount), 0.00),
        COALESCE(SUM(total_amount), 0.00)
    INTO v_subtotal, v_cgst, v_sgst, v_total_amount
    FROM orders
    WHERE table_session_id = p_session_id
      AND order_status NOT IN ('CANCELLED');

    IF v_total_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_ORDERS', 'message', 'No payable orders found in this session.');
    END IF;

    -- Generate invoice
    v_invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999 + 1)::text, 4, '0');

    INSERT INTO invoices (
        restaurant_id,
        order_id,
        table_session_id,
        table_id,
        invoice_number,
        subtotal,
        cgst_amount,
        sgst_amount,
        total_amount,
        payment_method,
        payment_status,
        issued_at
    ) VALUES (
        p_restaurant_id,
        (SELECT id FROM orders WHERE table_session_id = p_session_id ORDER BY created_at DESC LIMIT 1),
        p_session_id,
        p_table_id,
        v_invoice_num,
        v_subtotal,
        v_cgst,
        v_sgst,
        v_total_amount,
        p_payment_method,
        'PAID',
        NOW()
    ) RETURNING id INTO v_invoice_id;

    -- Record Payment
    INSERT INTO payments (
        restaurant_id,
        order_id,
        table_session_id,
        amount,
        payment_method,
        payment_status,
        transaction_reference,
        verified_by,
        verified_at,
        created_at
    ) VALUES (
        p_restaurant_id,
        (SELECT id FROM orders WHERE table_session_id = p_session_id ORDER BY created_at DESC LIMIT 1),
        p_session_id,
        v_total_amount,
        p_payment_method,
        'SUCCESS',
        COALESCE(p_transaction_ref, 'TXN-' || replace(gen_random_uuid()::text, '-', '')),
        v_caller_id,
        NOW(),
        NOW()
    ) RETURNING id INTO v_payment_id;

    -- Close all session orders
    UPDATE orders
    SET order_status = 'SERVED',
        updated_at = NOW()
    WHERE table_session_id = p_session_id
      AND order_status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY');

    -- Close table session
    UPDATE table_sessions
    SET status = 'CLOSED',
        closed_at = NOW()
    WHERE id = p_session_id;

    -- Put table in CLEANING state
    UPDATE restaurant_tables
    SET status = 'CLEANING',
        updated_at = NOW()
    WHERE id = p_table_id;

    -- Evaluate loyalty stamp if customer phone attached
    IF v_session.customer_phone IS NOT NULL AND length(v_session.customer_phone) >= 10 THEN
        SELECT * INTO v_customer
        FROM customers
        WHERE phone = v_session.customer_phone AND restaurant_id = p_restaurant_id;

        IF FOUND THEN
            SELECT * INTO v_loyalty_account
            FROM loyalty_accounts
            WHERE customer_id = v_customer.id AND restaurant_id = p_restaurant_id
            FOR UPDATE;

            IF FOUND AND v_total_amount >= 250.00 THEN
                UPDATE loyalty_accounts
                SET total_stamps = total_stamps + 1,
                    total_spent = total_spent + v_total_amount,
                    updated_at = NOW()
                WHERE id = v_loyalty_account.id;

                INSERT INTO loyalty_stamps (
                    restaurant_id,
                    loyalty_account_id,
                    order_id,
                    payment_id,
                    stamps_awarded,
                    order_amount
                ) VALUES (
                    p_restaurant_id,
                    v_loyalty_account.id,
                    (SELECT id FROM orders WHERE table_session_id = p_session_id ORDER BY created_at DESC LIMIT 1),
                    v_payment_id,
                    1,
                    v_total_amount
                );
                v_stamp_awarded := TRUE;
            END IF;
        END IF;
    END IF;

    -- Security Audit Log
    INSERT INTO audit_logs (
        restaurant_id, user_id, user_role, action, entity_name, entity_id, payload
    ) VALUES (
        p_restaurant_id, v_caller_id, COALESCE(v_caller_role, 'service_role'),
        'SETTLE_BILL', 'invoices', v_invoice_id::text,
        jsonb_build_object(
            'table_id', p_table_id,
            'session_id', p_session_id,
            'amount', v_total_amount,
            'payment_method', p_payment_method,
            'invoice_number', v_invoice_num
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_num,
        'payment_id', v_payment_id,
        'total_amount', v_total_amount,
        'table_status', 'CLEANING',
        'stamp_awarded', v_stamp_awarded,
        'message', 'Bill settled successfully. Table ' || v_table.table_number || ' queued for cleaning.'
    );
END;
$$;

-- F. MARK TABLE CLEANED
CREATE OR REPLACE FUNCTION public.mark_table_cleaned(
    p_restaurant_id character varying, 
    p_table_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role VARCHAR;
    v_table RECORD;
BEGIN
    -- Verify authorized role: waiter, counter, admin, owner
    SELECT role_id INTO v_caller_role
    FROM profiles
    WHERE id = auth.uid() AND restaurant_id = p_restaurant_id AND is_active = true;

    IF auth.role() <> 'service_role' AND (v_caller_role IS NULL OR v_caller_role NOT IN ('waiter', 'counter', 'admin', 'owner')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Unauthorized to mark table cleaned.');
    END IF;

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
$$;

-- G. CONFIRM CASH PAYMENT
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
    p_payment_id uuid, 
    p_staff_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role VARCHAR;
    v_payment RECORD;
    v_effective_staff_id UUID;
BEGIN
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'PAYMENT_NOT_FOUND', 'message', 'Payment record not found.');
    END IF;

    -- Verify caller authority
    SELECT role_id INTO v_caller_role
    FROM profiles
    WHERE id = v_caller_id AND restaurant_id = v_payment.restaurant_id AND is_active = true;

    IF auth.role() <> 'service_role' AND (v_caller_role IS NULL OR v_caller_role NOT IN ('counter', 'admin', 'owner')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only Cashier or Admin can confirm cash payments.');
    END IF;

    v_effective_staff_id := COALESCE(v_caller_id, p_staff_id);

    UPDATE payments
    SET payment_status = 'SUCCESS',
        verified_by = v_effective_staff_id,
        verified_at = NOW()
    WHERE id = p_payment_id;

    UPDATE invoices
    SET payment_status = 'PAID'
    WHERE order_id = v_payment.order_id;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'status', 'SUCCESS',
        'message', 'Cash payment confirmed by cashier.'
    );
END;
$$;

-- H. VERIFY TABLE QR TOKEN
CREATE OR REPLACE FUNCTION public.verify_table_qr_token(
    p_token_hash text, 
    p_ip_address text DEFAULT NULL::text, 
    p_user_agent text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
        v_new_session_token := 'ses-' || replace(gen_random_uuid()::text, '-', '');

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

-- --------------------------------------------------------------------
-- 6. PERMISSIONS & GRANTS
-- --------------------------------------------------------------------

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM public;

-- Grant EXECUTE on guest-safe functions to anon, authenticated, and service_role
GRANT EXECUTE ON FUNCTION public.verify_table_qr_token(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.server_calculate_order_totals(jsonb, numeric, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_restaurant_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_member(character varying) TO anon, authenticated, service_role;

-- Grant EXECUTE on staff functions ONLY to authenticated staff and service_role
GRANT EXECUTE ON FUNCTION public.generate_permanent_table_qr(character varying, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_daily_qr_tokens(character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_table_daily_collection_summary(character varying, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_table_bill_and_close_session(character varying, uuid, uuid, character varying, character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_table_cleaned(character varying, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_cash_payment(uuid, uuid) TO authenticated, service_role;
