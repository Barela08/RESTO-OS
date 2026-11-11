-- ====================================================================
-- RESTO OS - PostgreSQL Schema Migration: 000001_initial_schema.sql
-- Complete Relational Tables with UUID PKs, FKs, Constraints & Indexes
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 1. CORE & RESTAURANT SETUP
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tagline VARCHAR(255),
    logo_url TEXT,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    gstin VARCHAR(50),
    fssai_license VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'INR',
    currency_symbol VARCHAR(5) DEFAULT '₹',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    brand_primary_color VARCHAR(20) DEFAULT '#7047EB',
    brand_accent_color VARCHAR(20) DEFAULT '#F97316',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    cgst_rate NUMERIC(5,2) DEFAULT 2.50,
    sgst_rate NUMERIC(5,2) DEFAULT 2.50,
    service_charge_rate NUMERIC(5,2) DEFAULT 0.00,
    enable_loyalty BOOLEAN DEFAULT TRUE,
    loyalty_min_order_amount NUMERIC(10,2) DEFAULT 200.00,
    loyalty_stamps_per_order INT DEFAULT 1,
    loyalty_stamps_for_reward INT DEFAULT 8,
    loyalty_reward_name VARCHAR(100) DEFAULT 'Complimentary Chef Special Dessert or Starter',
    loyalty_reward_validity_days INT DEFAULT 30,
    allow_guest_ordering BOOLEAN DEFAULT TRUE,
    auto_accept_orders BOOLEAN DEFAULT FALSE,
    qr_auto_expire_hours INT DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_restaurant_settings UNIQUE (restaurant_id)
);

CREATE TABLE IF NOT EXISTS staff_roles (
    id VARCHAR(32) PRIMARY KEY, -- 'admin', 'owner', 'waiter', 'kitchen', 'counter'
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id VARCHAR(32) REFERENCES staff_roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- Maps to auth.users.id
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role_id VARCHAR(32) REFERENCES staff_roles(id),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    designation VARCHAR(100),
    shift_preference VARCHAR(50) DEFAULT 'general',
    is_on_duty BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_staff_code UNIQUE (restaurant_id, employee_code)
);

-- --------------------------------------------------------------------
-- 2. TABLES & DYNAMIC QR SYSTEM
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(20) NOT NULL,
    seating_capacity INT NOT NULL DEFAULT 4,
    floor_area VARCHAR(50) DEFAULT 'Main Dining',
    description TEXT,
    status VARCHAR(30) DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'RESERVED', 'PAYMENT_PENDING', 'CLEANING', 'DISABLED'
    current_waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_table_number UNIQUE (restaurant_id, table_number)
);

CREATE TABLE IF NOT EXISTS table_qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    valid_date DATE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    generation_batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_table_valid_date UNIQUE (table_id, valid_date)
);

CREATE TABLE IF NOT EXISTS qr_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    generation_date DATE NOT NULL,
    total_tables_processed INT DEFAULT 0,
    successful_tokens_created INT DEFAULT 0,
    failed_tokens INT DEFAULT 0,
    generated_by VARCHAR(50) DEFAULT 'SCHEDULED_SYSTEM_CRON',
    status VARCHAR(20) DEFAULT 'COMPLETED',
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    qr_token_id UUID REFERENCES table_qr_tokens(id),
    session_token VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAYMENT_PENDING', 'CLOSED'
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qr_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    qr_token_id UUID REFERENCES table_qr_tokens(id),
    session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_repeat_scan BOOLEAN DEFAULT FALSE,
    scan_status VARCHAR(30) DEFAULT 'VERIFIED', -- 'VERIFIED', 'REPEAT_PENDING', 'EXPIRED', 'REVOKED', 'INVALID'
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repeat_scan_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    existing_session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    new_scan_time TIMESTAMPTZ DEFAULT NOW(),
    customer_identifier VARCHAR(100),
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED_CONTINUE', 'APPROVED_NEW', 'REJECTED'
    handled_by_staff_id UUID REFERENCES staff(id),
    handled_at TIMESTAMPTZ,
    decision_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waiter_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 3. KITCHEN STATIONS & MENU
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL, -- 'Main Kitchen', 'Beverage Counter', 'Dessert Counter', 'Fast Food Counter'
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_station_code UNIQUE (restaurant_id, code)
);

CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    icon_name VARCHAR(50) DEFAULT 'Utensils',
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id) ON DELETE CASCADE,
    kitchen_station_id UUID REFERENCES kitchen_stations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price NUMERIC(10,2) NOT NULL,
    is_veg BOOLEAN DEFAULT TRUE,
    is_vegan BOOLEAN DEFAULT FALSE,
    is_gluten_free BOOLEAN DEFAULT FALSE,
    spicy_level INT DEFAULT 0, -- 0 = None, 1 = Mild, 2 = Medium, 3 = High
    prep_time_minutes INT DEFAULT 15,
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,
    is_recommended BOOLEAN DEFAULT FALSE,
    calories INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'Regular', 'Large', 'Extra Large'
    price_delta NUMERIC(10,2) DEFAULT 0.00,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'Extra Cheese', 'Jalapenos', 'Garlic Dip'
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_item_addons (
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES menu_addons(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, addon_id)
);

-- --------------------------------------------------------------------
-- 4. ORDERING & KITCHEN TICKETS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    order_number VARCHAR(50) NOT NULL,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE RESTRICT,
    waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    customer_id UUID, -- Optional link to registered customer
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    subtotal_amount NUMERIC(10,2) NOT NULL,
    cgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    service_charge_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'PLACED', -- 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'REJECTED'
    rejection_reason TEXT,
    special_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_order_number UNIQUE (restaurant_id, order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES menu_variants(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(100),
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10,2) NOT NULL,
    special_instructions TEXT,
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'
    kitchen_station_id UUID REFERENCES kitchen_stations(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES menu_addons(id) ON DELETE RESTRICT,
    addon_name VARCHAR(100) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_role VARCHAR(32),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kitchen_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    station_id UUID REFERENCES kitchen_stations(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'NEW', -- 'NEW', 'ACCEPTED', 'PREPARING', 'READY', 'HANDED_OVER', 'REJECTED'
    rejection_reason TEXT,
    accepted_at TIMESTAMPTZ,
    prep_started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    handed_over_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kitchen_ticket_id UUID REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    item_notes TEXT,
    status VARCHAR(30) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 5. SERVICE & CALLS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waiter_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE CASCADE,
    assigned_waiter_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    request_type VARCHAR(50) DEFAULT 'ASSISTANCE', -- 'ASSISTANCE', 'CALL_WAITER', 'REQUEST_BILL', 'CLEANING', 'WATER'
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    notes TEXT,
    acknowledged_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 6. PAYMENTS & INVOICES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE RESTRICT,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- Can be null if consolidated table session billing
    amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL, -- 'CASH', 'UPI', 'RAZORPAY', 'CARD'
    payment_status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'
    gateway_order_id VARCHAR(100),
    gateway_payment_id VARCHAR(100),
    gateway_signature VARCHAR(255),
    cash_received_amount NUMERIC(10,2),
    cash_change_amount NUMERIC(10,2),
    confirmed_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE RESTRICT,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    subtotal_amount NUMERIC(10,2) NOT NULL,
    cgst_rate NUMERIC(5,2) NOT NULL,
    cgst_amount NUMERIC(10,2) NOT NULL,
    sgst_rate NUMERIC(5,2) NOT NULL,
    sgst_amount NUMERIC(10,2) NOT NULL,
    service_charge_amount NUMERIC(10,2) DEFAULT 0.00,
    discount_amount NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    transaction_ref VARCHAR(100),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_invoice_number UNIQUE (restaurant_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    authorized_by_staff_id UUID REFERENCES staff(id) ON DELETE RESTRICT,
    status VARCHAR(30) DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 7. CUSTOMERS & DIGITAL LOYALTY STAMPS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    is_phone_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_customer_phone UNIQUE (restaurant_id, phone)
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    total_stamps_earned INT DEFAULT 0,
    current_active_stamps INT DEFAULT 0,
    total_rewards_unlocked INT DEFAULT 0,
    total_rewards_redeemed INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_customer_loyalty UNIQUE (restaurant_id, customer_id)
);

CREATE TABLE IF NOT EXISTS loyalty_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    loyalty_account_id UUID REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
    payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    stamps_awarded INT DEFAULT 1,
    order_amount NUMERIC(10,2) NOT NULL,
    is_reversed BOOLEAN DEFAULT FALSE,
    reversed_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_order_stamp UNIQUE (order_id)
);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    loyalty_account_id UUID REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
    voucher_code VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_at TIMESTAMPTZ,
    redeemed_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 8. INVENTORY & RECIPES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(50),
    unit VARCHAR(30) NOT NULL, -- 'kg', 'liter', 'gram', 'piece', 'packet'
    current_stock NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    min_stock_alert NUMERIC(12,3) NOT NULL DEFAULT 5.000,
    cost_per_unit NUMERIC(10,2) DEFAULT 0.00,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_inventory_sku UNIQUE (restaurant_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    movement_type VARCHAR(30) NOT NULL, -- 'PURCHASE', 'ORDER_CONSUMPTION', 'WASTAGE', 'CORRECTION'
    quantity_delta NUMERIC(12,3) NOT NULL,
    new_stock_level NUMERIC(12,3) NOT NULL,
    reference_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    logged_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE UNIQUE,
    instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE RESTRICT,
    quantity_required NUMERIC(12,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_recipe_ingredient UNIQUE (recipe_id, inventory_item_id)
);

-- --------------------------------------------------------------------
-- 9. BUSINESS, EXPENSES, AUDIT & NOTIFICATIONS
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- 'Raw Materials', 'Utilities', 'Salaries', 'Rent', 'Maintenance', 'Marketing'
    amount NUMERIC(10,2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    receipt_url TEXT,
    logged_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    recipient_role VARCHAR(32), -- 'waiter', 'kitchen', 'counter', 'admin', 'owner'
    recipient_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'NEW_ORDER', 'ORDER_READY', 'CALL_WAITER', 'REPEAT_SCAN', 'CASH_PAYMENT', 'LOYALTY_EARNED'
    reference_id VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    sound_type VARCHAR(30) DEFAULT 'CHIME',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id VARCHAR(64) REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_role VARCHAR(32),
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    payload JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY SPEED & RELIABILITY
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tables_status ON restaurant_tables(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_valid ON table_qr_tokens(restaurant_id, valid_date, is_revoked);
CREATE INDEX IF NOT EXISTS idx_table_sessions_active ON table_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_table_session ON orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_status ON kitchen_tickets(restaurant_id, status, station_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(restaurant_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(restaurant_id, recipient_role, is_read);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_status ON waiter_calls(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_repeat_scans_status ON repeat_scan_requests(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory_items(restaurant_id, current_stock);
