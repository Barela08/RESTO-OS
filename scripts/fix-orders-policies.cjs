const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  console.log('Fixing policies on orders, order_items, kitchen_tickets...');
  await client.query(`
    -- 1. ORDERS
    DROP POLICY IF EXISTS orders_guest_read ON orders;
    DROP POLICY IF EXISTS orders_staff_read ON orders;
    DROP POLICY IF EXISTS orders_staff_update ON orders;
    DROP POLICY IF EXISTS orders_guest_create ON orders;
    DROP POLICY IF EXISTS "Public and staff can view orders" ON orders;
    DROP POLICY IF EXISTS "Public and staff can insert orders" ON orders;
    DROP POLICY IF EXISTS "Public and staff can update orders" ON orders;

    CREATE POLICY "Public and staff can view orders" ON orders
      FOR SELECT TO public USING (true);

    CREATE POLICY "Public and staff can insert orders" ON orders
      FOR INSERT TO public WITH CHECK (true);

    CREATE POLICY "Public and staff can update orders" ON orders
      FOR UPDATE TO public USING (true) WITH CHECK (true);

    -- 2. ORDER ITEMS
    DROP POLICY IF EXISTS order_items_guest_read ON order_items;
    DROP POLICY IF EXISTS order_items_staff_read ON order_items;
    DROP POLICY IF EXISTS order_items_staff_update ON order_items;
    DROP POLICY IF EXISTS order_items_guest_create ON order_items;
    DROP POLICY IF EXISTS "Public and staff can view order items" ON order_items;
    DROP POLICY IF EXISTS "Public and staff can insert order items" ON order_items;
    DROP POLICY IF EXISTS "Public and staff can update order items" ON order_items;

    CREATE POLICY "Public and staff can view order items" ON order_items
      FOR SELECT TO public USING (true);

    CREATE POLICY "Public and staff can insert order items" ON order_items
      FOR INSERT TO public WITH CHECK (true);

    CREATE POLICY "Public and staff can update order items" ON order_items
      FOR UPDATE TO public USING (true) WITH CHECK (true);

    -- 3. KITCHEN TICKETS
    DROP POLICY IF EXISTS kitchen_tickets_create ON kitchen_tickets;
    DROP POLICY IF EXISTS kitchen_tickets_staff_read ON kitchen_tickets;
    DROP POLICY IF EXISTS kitchen_tickets_staff_update ON kitchen_tickets;
    DROP POLICY IF EXISTS "Public and staff can view kitchen tickets" ON kitchen_tickets;
    DROP POLICY IF EXISTS "Public and staff can insert kitchen tickets" ON kitchen_tickets;
    DROP POLICY IF EXISTS "Public and staff can update kitchen tickets" ON kitchen_tickets;

    CREATE POLICY "Public and staff can view kitchen tickets" ON kitchen_tickets
      FOR SELECT TO public USING (true);

    CREATE POLICY "Public and staff can insert kitchen tickets" ON kitchen_tickets
      FOR INSERT TO public WITH CHECK (true);

    CREATE POLICY "Public and staff can update kitchen tickets" ON kitchen_tickets
      FOR UPDATE TO public USING (true) WITH CHECK (true);
  `);

  console.log('Orders, items, and kitchen tickets policies updated successfully!');
  await client.end();
}

run().catch(console.error);
