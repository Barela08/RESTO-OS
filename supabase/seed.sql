-- ====================================================================
-- RESTO OS - PostgreSQL Seed Data: seed.sql
-- Production-Ready Seed with Restaurant, Tables, QRs, Menu, Staff & Orders
-- ====================================================================

-- 1. RESTAURANT & SETTINGS
INSERT INTO restaurants (
    id, name, tagline, logo_url, address, city, state, country, postal_code, phone, email, gstin, fssai_license, currency, currency_symbol, timezone, brand_primary_color, brand_accent_color
) VALUES (
    'rest-001-main',
    'The Grand Bistro & Craft Kitchen',
    'Artisanal Flavors, Smart Dining Experience',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
    '108 Platinum Tower, Ring Road, Indiranagar',
    'Bengaluru',
    'Karnataka',
    'India',
    '560038',
    '+91 98765 43210',
    'contact@thegrandbistro.in',
    '29ABCDE1234F1Z5',
    '11223344556677',
    'INR',
    '₹',
    'Asia/Kolkata',
    '#7047EB',
    '#F97316'
) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO restaurant_settings (
    restaurant_id, cgst_rate, sgst_rate, service_charge_rate, enable_loyalty, loyalty_min_order_amount, loyalty_stamps_per_order, loyalty_stamps_for_reward, loyalty_reward_name, loyalty_reward_validity_days, allow_guest_ordering
) VALUES (
    'rest-001-main', 2.50, 2.50, 0.00, true, 250.00, 1, 8, 'Complimentary Gourmet Dessert or Craft Starter', 30, true
) ON CONFLICT (restaurant_id) DO NOTHING;

-- 2. STAFF ROLES
INSERT INTO staff_roles (id, name, description) VALUES
('admin', 'Administrator', 'Full system access and configurations'),
('owner', 'Restaurant Owner', 'Access to executive analytics, revenue and financial statements'),
('waiter', 'Serving Staff', 'Table service, order delivery, call waiter management'),
('kitchen', 'Chef & Kitchen Line', 'KDS ticket processing, preparation updates, station routing'),
('counter', 'Cash Counter / POS', 'Bill settlement, cash verification, repeat QR approvals, tax invoices')
ON CONFLICT (id) DO NOTHING;

-- 3. PROFILES & STAFF
-- Admin user
INSERT INTO profiles (id, restaurant_id, email, full_name, phone, role_id, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'rest-001-main', 'admin@resto.os', 'Rajesh Sharma', '+91 99000 11223', 'admin', true),
('22222222-2222-2222-2222-222222222222', 'rest-001-main', 'owner@resto.os', 'Vikramaditya Roy', '+91 99000 22334', 'owner', true),
('33333333-3333-3333-3333-333333333333', 'rest-001-main', 'waiter@resto.os', 'Arun Kumar', '+91 99000 33445', 'waiter', true),
('44444444-4444-4444-4444-444444444444', 'rest-001-main', 'kitchen@resto.os', 'Chef Sanjeev Anand', '+91 99000 44556', 'kitchen', true),
('55555555-5555-5555-5555-555555555555', 'rest-001-main', 'counter@resto.os', 'Priya Deshmukh', '+91 99000 55667', 'counter', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff (id, restaurant_id, profile_id, employee_code, designation, shift_preference, is_on_duty) VALUES
('a0000001-0000-0000-0000-000000000001', 'rest-001-main', '11111111-1111-1111-1111-111111111111', 'EMP-ADM-01', 'General Operations Manager', 'morning', true),
('a0000001-0000-0000-0000-000000000002', 'rest-001-main', '22222222-2222-2222-2222-222222222222', 'EMP-OWN-01', 'Managing Partner & Owner', 'general', true),
('a0000001-0000-0000-0000-000000000003', 'rest-001-main', '33333333-3333-3333-3333-333333333333', 'EMP-WTR-01', 'Senior Captain / Waiter', 'evening', true),
('a0000001-0000-0000-0000-000000000004', 'rest-001-main', '44444444-4444-4444-4444-444444444444', 'EMP-KIT-01', 'Executive Head Chef', 'evening', true),
('a0000001-0000-0000-0000-000000000005', 'rest-001-main', '55555555-5555-5555-5555-555555555555', 'EMP-CTR-01', 'Cashier & Front Desk Lead', 'evening', true)
ON CONFLICT DO NOTHING;

-- 4. KITCHEN STATIONS
INSERT INTO kitchen_stations (id, restaurant_id, code, name, description, display_order, is_active) VALUES
('b0000001-0000-0000-0000-000000000001', 'rest-001-main', 'MAIN_KITCHEN', 'Main Kitchen (Curries & Tandoor)', 'Hot gravies, artisanal breads & sizzlers', 1, true),
('b0000001-0000-0000-0000-000000000002', 'rest-001-main', 'BEVERAGE_BAR', 'Beverage & Mocktail Bar', 'Fresh juices, smoothies, craft sodas & coolers', 2, true),
('b0000001-0000-0000-0000-000000000003', 'rest-001-main', 'DESSERT_STATION', 'Artisan Dessert Station', 'Pastries, warm puddings, gelato & sundaes', 3, true),
('b0000001-0000-0000-0000-000000000004', 'rest-001-main', 'FAST_FOOD_OVEN', 'Stone Oven & Fast Bites', 'Woodfired pizzas, sliders, nachos & wraps', 4, true)
ON CONFLICT (id) DO NOTHING;

-- 5. RESTAURANT TABLES
INSERT INTO restaurant_tables (id, restaurant_id, table_number, seating_capacity, floor_area, description, status, current_waiter_id, is_active) VALUES
('c0000001-0000-0000-0000-000000000001', 'rest-001-main', 'T-01', 2, 'Main Dining', 'Cozy window table for couples', 'OCCUPIED', 'a0000001-0000-0000-0000-000000000003', true),
('c0000001-0000-0000-0000-000000000002', 'rest-001-main', 'T-02', 4, 'Main Dining', 'Standard central family booth', 'AVAILABLE', 'a0000001-0000-0000-0000-000000000003', true),
('c0000001-0000-0000-0000-000000000003', 'rest-001-main', 'T-03', 4, 'Main Dining', 'Corner booth with plush seating', 'OCCUPIED', 'a0000001-0000-0000-0000-000000000003', true),
('c0000001-0000-0000-0000-000000000004', 'rest-001-main', 'T-04', 6, 'Patio Garden', 'Open-air garden banquet table', 'PAYMENT_PENDING', 'a0000001-0000-0000-0000-000000000003', true),
('c0000001-0000-0000-0000-000000000005', 'rest-001-main', 'T-05', 4, 'Patio Garden', 'Outdoor shaded garden gazebo', 'AVAILABLE', 'a0000001-0000-0000-0000-000000000003', true),
('c0000001-0000-0000-0000-000000000006', 'rest-001-main', 'T-06', 8, 'First Floor Lounge', 'VIP large banquet table', 'RESERVED', 'a0000001-0000-0000-0000-000000000003', true),
('c0000001-0000-0000-0000-000000000007', 'rest-001-main', 'T-07', 2, 'Terrace Deck', 'Rooftop high-top table with skyline view', 'CLEANING', 'a0000001-0000-0000-0000-000000000003', true),
('c0000001-0000-0000-0000-000000000008', 'rest-001-main', 'T-08', 4, 'Terrace Deck', 'Rooftop dining under ambient fairy lights', 'AVAILABLE', 'a0000001-0000-0000-0000-000000000003', true)
ON CONFLICT (id) DO NOTHING;

-- 6. MENU CATEGORIES
INSERT INTO menu_categories (id, restaurant_id, name, description, display_order, icon_name, image_url, is_active) VALUES
('d0000001-0000-0000-0000-000000000001', 'rest-001-main', 'Starters & Small Plates', 'Crispy, smoky and savory appetizers crafted for sharing', 1, 'Utensils', 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=500&q=80', true),
('d0000001-0000-0000-0000-000000000002', 'rest-001-main', 'Woodfired Pizzas & Burgers', 'Hand-stretched sourdough pizzas & smash brioche burgers', 2, 'Pizza', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80', true),
('d0000001-0000-0000-0000-000000000003', 'rest-001-main', 'Signature Main Course', 'Rich aromatic gravies, fragrant biryanis and artisan breads', 3, 'Soup', 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=500&q=80', true),
('d0000001-0000-0000-0000-000000000004', 'rest-001-main', 'Beverages & Mocktails', 'Cold-pressed quenchers, iced teas and fizzy coolers', 4, 'Coffee', 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=500&q=80', true),
('d0000001-0000-0000-0000-000000000005', 'rest-001-main', 'Decadent Desserts', 'House-churned gelatos, molten lava cakes and classic sweets', 5, 'IceCream', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80', true)
ON CONFLICT (id) DO NOTHING;

-- 7. MENU ITEMS
INSERT INTO menu_items (
    id, restaurant_id, category_id, kitchen_station_id, name, description, base_price, is_veg, is_vegan, is_gluten_free, spicy_level, prep_time_minutes, image_url, is_available, is_popular, is_recommended
) VALUES
-- Starters
('e0000001-0000-0000-0000-000000000001', 'rest-001-main', 'd0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001',
 'Truffle Mushroom Bruschetta', 'Toasted sourdough baguette topped with sautéed wild mushrooms, garlic herb butter and white truffle drizzle.', 345.00, true, false, false, 0, 12,
 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=500&q=80', true, true, true),

('e0000001-0000-0000-0000-000000000002', 'rest-001-main', 'd0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001',
 'Crispy Peri-Peri Paneer Bites', 'Cottage cheese cubes tossed in spicy African bird’s eye chili glaze with mint cilantro dip.', 320.00, true, false, true, 2, 10,
 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=500&q=80', true, true, false),

('e0000001-0000-0000-0000-000000000003', 'rest-001-main', 'd0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001',
 'Amritsari Fish Fry', 'Crispy carom seed-battered river sole fillets served with pickled red onions and tart dip.', 460.00, false, false, true, 1, 15,
 'https://images.unsplash.com/photo-1535400255456-984241443b29?auto=format&fit=crop&w=500&q=80', true, false, true),

-- Pizzas & Burgers
('e0000001-0000-0000-0000-000000000004', 'rest-001-main', 'd0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000004',
 'Artisan Margherita Pizza', 'San Marzano tomato base, fresh buffalo mozzarella, fragrant Genovese basil and cold-pressed olive oil.', 445.00, true, false, false, 0, 15,
 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=500&q=80', true, true, true),

('e0000001-0000-0000-0000-000000000005', 'rest-001-main', 'd0000001-0000-0000-0000-000000000002', 'b0000001-0000-0000-0000-000000000004',
 'Smoky BBQ Pulled Chicken Pizza', 'Slow-cooked shredded chicken, caramelized shallots, jalapeños, smoked Gouda and mozzarella.', 525.00, false, false, false, 1, 18,
 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=500&q=80', true, true, false),

-- Mains
('e0000001-0000-0000-0000-000000000006', 'rest-001-main', 'd0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001',
 'Paneer Tikka Lababdar', 'Charcoal-grilled cottage cheese in a silky tomato, cashew and bell pepper gravy finished with kasoori methi.', 420.00, true, false, true, 1, 20,
 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=500&q=80', true, true, true),

('e0000001-0000-0000-0000-000000000007', 'rest-001-main', 'd0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001',
 'Old Delhi Butter Chicken', 'Tender boneless chicken tikka simmered in a velvety slow-simmered tomato butter reduction.', 495.00, false, false, true, 1, 20,
 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=500&q=80', true, true, true),

('e0000001-0000-0000-0000-000000000008', 'rest-001-main', 'd0000001-0000-0000-0000-000000000003', 'b0000001-0000-0000-0000-000000000001',
 'Dum Gosht Biryani', 'Slow-cooked aromatic basmati rice layered with prime mutton chunks, saffron and fragrant whole spices.', 560.00, false, false, true, 2, 22,
 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80', true, true, true),

-- Beverages
('e0000001-0000-0000-0000-000000000009', 'rest-001-main', 'd0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000002',
 'Passionfruit Mint Sparkler', 'Fresh passionfruit pulp, crushed spearmint leaves, lime juice and sparkling soda.', 195.00, true, true, true, 0, 5,
 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=500&q=80', true, true, true),

('e0000001-0000-0000-0000-000000000010', 'rest-001-main', 'd0000001-0000-0000-0000-000000000004', 'b0000001-0000-0000-0000-000000000002',
 'Cold Brew Vanilla Foam', '16-hour steeped single-origin Arabica cold brew crowned with Madagascar vanilla cream foam.', 220.00, true, false, true, 0, 5,
 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=500&q=80', true, false, true),

-- Desserts
('e0000001-0000-0000-0000-000000000011', 'rest-001-main', 'd0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000003',
 'Belgian Dark Chocolate Molten Lava', 'Warm molten center cake with 70% Callebaut dark chocolate, paired with Tahitian vanilla bean gelato.', 295.00, true, false, false, 0, 14,
 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=500&q=80', true, true, true),

('e0000001-0000-0000-0000-000000000012', 'rest-001-main', 'd0000001-0000-0000-0000-000000000005', 'b0000001-0000-0000-0000-000000000003',
 'Classic Italian Tiramisu', 'Savoiardi ladyfingers soaked in espresso and mascarpone zabaglione dusted with rich cocoa powder.', 310.00, true, false, false, 0, 8,
 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=80', true, false, true)
ON CONFLICT (id) DO NOTHING;

-- 8. MENU ADDONS
INSERT INTO menu_addons (id, restaurant_id, name, price, is_available) VALUES
('f0000001-0000-0000-0000-000000000001', 'rest-001-main', 'Extra Artisanal Cheese', 60.00, true),
('f0000001-0000-0000-0000-000000000002', 'rest-001-main', 'Spicy Pickled Jalapeños', 40.00, true),
('f0000001-0000-0000-0000-000000000003', 'rest-001-main', 'Truffle Aioli Dip', 50.00, true),
('f0000001-0000-0000-0000-000000000004', 'rest-001-main', 'Garlic Butter Naan Portion', 75.00, true)
ON CONFLICT (id) DO NOTHING;

-- 9. INVENTORY ITEMS & SUPPLIERS
INSERT INTO suppliers (id, restaurant_id, name, contact_person, phone, email, address, is_active) VALUES
('s0000001-0000-0000-0000-000000000001', 'rest-001-main', 'Metro Fresh Farms & Dairy', 'Sunil Gowda', '+91 98877 66554', 'orders@metrofresh.com', 'Yeshwanthpur APMC Yard', true),
('s0000001-0000-0000-0000-000000000002', 'rest-001-main', 'Gourmet World Spices & Imports', 'Harish Nair', '+91 97766 55443', 'supply@gourmetworld.in', 'Electronic City Phase 1', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO inventory_items (id, restaurant_id, name, sku, unit, current_stock, min_stock_alert, cost_per_unit, supplier_id, is_active) VALUES
('i0000001-0000-0000-0000-000000000001', 'rest-001-main', 'Fresh Organic Paneer', 'SKU-PAN-01', 'kg', 14.500, 5.000, 320.00, 's0000001-0000-0000-0000-000000000001', true),
('i0000001-0000-0000-0000-000000000002', 'rest-001-main', 'Fresh Boneless Chicken Breast', 'SKU-CHK-01', 'kg', 22.000, 8.000, 240.00, 's0000001-0000-0000-0000-000000000001', true),
('i0000001-0000-0000-0000-000000000003', 'rest-001-main', 'Buffalo Mozzarella Blocks', 'SKU-MOZ-01', 'kg', 8.200, 4.000, 580.00, 's0000001-0000-0000-0000-000000000001', true),
('i0000001-0000-0000-0000-000000000004', 'rest-001-main', 'Single-Origin Arabica Beans', 'SKU-COF-01', 'kg', 6.000, 2.000, 850.00, 's0000001-0000-0000-0000-000000000002', true),
('i0000001-0000-0000-0000-000000000005', 'rest-001-main', 'Callebaut 70% Dark Chocolate', 'SKU-CHO-01', 'kg', 12.000, 3.000, 1100.00, 's0000001-0000-0000-0000-000000000002', true)
ON CONFLICT (id) DO NOTHING;


-- 10. PAYMENT SETTINGS & VOICE SETTINGS
INSERT INTO payment_settings (
    restaurant_id, upi_id, merchant_name, qr_image_url, upi_enabled, cash_enabled, manual_verification_enabled, require_transaction_ref, payment_instructions, upi_display_name
) VALUES (
    'rest-001-main', 'grandbistro@okaxis', 'The Grand Bistro & Craft Kitchen',
    'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=grandbistro@okaxis&pn=The+Grand+Bistro&cu=INR',
    true, true, true, true,
    'Scan with any UPI app (Google Pay, PhonePe, Paytm, BHIM) and submit the 12-digit UTR/Ref number for counter approval.',
    'Direct UPI Payment (0% Fee)'
) ON CONFLICT (restaurant_id) DO NOTHING;

INSERT INTO voice_settings (
    restaurant_id, user_id, language, voice_enabled, sound_enabled, volume, speech_rate, repeat_count
) VALUES (
    'rest-001-main', '11111111-1111-1111-1111-111111111111', 'hi', true, true, 1.0, 1.0, 1
) ON CONFLICT (restaurant_id, user_id) DO NOTHING;

-- 11. LOYALTY PROGRAMS
INSERT INTO loyalty_programs (
    id, restaurant_id, program_name, description, min_order_amount, stamps_per_order, stamps_required, reward_description, validity_days, is_active
) VALUES (
    'l0000001-0000-0000-0000-000000000001', 'rest-001-main', 'Bistro Epicure Club',
    'Earn 1 stamp on every dining order above ₹250. Collect 8 stamps to unlock a Complimentary Gourmet Starter or Artisan Dessert!',
    250.00, 1, 8, 'Complimentary Gourmet Dessert or Craft Starter', 30, true
) ON CONFLICT (id) DO NOTHING;

-- 12. SHIFTS & ATTENDANCE
INSERT INTO shifts (
    id, restaurant_id, staff_id, shift_name, start_time, end_time, shift_date, status
) VALUES 
('sh-0001-0000-0000-000000000001', 'rest-001-main', 'a0000001-0000-0000-0000-000000000003', 'Evening Dinner Shift', '16:00:00', '23:30:00', CURRENT_DATE, 'ACTIVE'),
('sh-0001-0000-0000-000000000002', 'rest-001-main', 'a0000001-0000-0000-0000-000000000004', 'Dinner Line Shift', '15:30:00', '23:30:00', CURRENT_DATE, 'ACTIVE'),
('sh-0001-0000-0000-000000000003', 'rest-001-main', 'a0000001-0000-0000-0000-000000000005', 'Evening Counter Shift', '16:00:00', '23:45:00', CURRENT_DATE, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO attendance (
    id, restaurant_id, staff_id, shift_id, check_in_time, status, notes
) VALUES
('at-0001-0000-0000-000000000001', 'rest-001-main', 'a0000001-0000-0000-0000-000000000003', 'sh-0001-0000-0000-000000000001', NOW() - INTERVAL '3 hours', 'ON_TIME', 'Punched in via Staff Portal'),
('at-0001-0000-0000-000000000002', 'rest-001-main', 'a0000001-0000-0000-0000-000000000004', 'sh-0001-0000-0000-000000000002', NOW() - INTERVAL '3 hours 30 minutes', 'ON_TIME', 'Punched in Kitchen line'),
('at-0001-0000-0000-000000000003', 'rest-001-main', 'a0000001-0000-0000-0000-000000000005', 'sh-0001-0000-0000-000000000003', NOW() - INTERVAL '3 hours', 'ON_TIME', 'Punched at Cash Counter')
ON CONFLICT (id) DO NOTHING;
