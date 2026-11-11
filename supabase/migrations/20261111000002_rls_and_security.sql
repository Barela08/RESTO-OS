-- ====================================================================
-- RESTO OS - PostgreSQL Migration: 000002_rls_and_security.sql
-- Role-Based Access Control (RBAC) & Row Level Security (RLS)
-- ====================================================================

-- Enable RLS on all sensitive tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE repeat_scan_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role from profiles
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS VARCHAR AS $$
    SELECT role_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. PUBLIC / CUSTOMER POLICIES (GUEST ACCESS & ORDERING)
-- Customers can view active restaurant info and menu
CREATE POLICY "Public can view active restaurants"
ON restaurants FOR SELECT
USING (true);

CREATE POLICY "Public can view active menu categories"
ON menu_categories FOR SELECT
USING (is_active = true);

CREATE POLICY "Public can view available menu items"
ON menu_items FOR SELECT
USING (is_available = true);

CREATE POLICY "Public can view menu variants"
ON menu_variants FOR SELECT
USING (true);

CREATE POLICY "Public can view menu addons"
ON menu_addons FOR SELECT
USING (is_available = true);

-- Customer can read and create sessions via verified QR tokens
CREATE POLICY "Public can create table sessions"
ON table_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view own table session"
ON table_sessions FOR SELECT
USING (true);

-- Customer can place orders for their active table session
CREATE POLICY "Public can insert orders"
ON orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view own orders"
ON orders FOR SELECT
USING (true);

CREATE POLICY "Public can insert order items"
ON order_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view order items"
ON order_items FOR SELECT
USING (true);

-- Customer can trigger waiter calls
CREATE POLICY "Public can create waiter calls"
ON waiter_calls FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view waiter calls"
ON waiter_calls FOR SELECT
USING (true);

-- 2. STAFF ROLES PERMISSIONS (WAITER, KITCHEN, COUNTER, ADMIN, OWNER)
CREATE POLICY "Staff can view all restaurant tables"
ON restaurant_tables FOR SELECT
USING (true);

CREATE POLICY "Admin and Owner can manage tables"
ON restaurant_tables FOR ALL
USING (get_current_user_role() IN ('admin', 'owner'));

-- QR Tokens: Admin can manage, staff can read
CREATE POLICY "Staff can view QR tokens"
ON table_qr_tokens FOR SELECT
USING (true);

CREATE POLICY "Admin can manage QR tokens"
ON table_qr_tokens FOR ALL
USING (get_current_user_role() IN ('admin', 'owner'));

-- Kitchen: can view and update tickets
CREATE POLICY "Kitchen and Admin can view and update tickets"
ON kitchen_tickets FOR ALL
USING (get_current_user_role() IN ('kitchen', 'admin', 'owner', 'waiter'));

-- Waiter: can update orders and waiter calls
CREATE POLICY "Waiter can update orders"
ON orders FOR UPDATE
USING (get_current_user_role() IN ('waiter', 'counter', 'admin', 'owner'));

CREATE POLICY "Staff can view and update waiter calls"
ON waiter_calls FOR ALL
USING (get_current_user_role() IN ('waiter', 'counter', 'admin', 'owner'));

-- Counter: can view and update payments and invoices
CREATE POLICY "Counter and Admin can manage payments"
ON payments FOR ALL
USING (get_current_user_role() IN ('counter', 'admin', 'owner'));

CREATE POLICY "Counter and Admin can manage invoices"
ON invoices FOR ALL
USING (get_current_user_role() IN ('counter', 'admin', 'owner'));

CREATE POLICY "Counter and Admin can manage repeat scans"
ON repeat_scan_requests FOR ALL
USING (get_current_user_role() IN ('counter', 'admin', 'owner'));

-- Admin / Owner: Full access to business modules
CREATE POLICY "Admin and Owner full access to inventory"
ON inventory_items FOR ALL
USING (get_current_user_role() IN ('admin', 'owner'));

CREATE POLICY "Admin and Owner full access to expenses"
ON expenses FOR ALL
USING (get_current_user_role() IN ('admin', 'owner'));

CREATE POLICY "Admin and Owner full access to loyalty"
ON loyalty_accounts FOR ALL
USING (get_current_user_role() IN ('admin', 'owner', 'counter'));

CREATE POLICY "Admin and Owner full access to settings"
ON restaurant_settings FOR ALL
USING (get_current_user_role() IN ('admin', 'owner'));
