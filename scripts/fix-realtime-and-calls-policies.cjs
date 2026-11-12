const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  console.log('Fixing policies for waiter_calls, payments, restaurant_tables, and table_sessions...');
  await client.query(`
    -- 1. WAITER CALLS
    DROP POLICY IF EXISTS waiter_calls_guest_create ON waiter_calls;
    DROP POLICY IF EXISTS waiter_calls_guest_read ON waiter_calls;
    DROP POLICY IF EXISTS waiter_calls_staff_read ON waiter_calls;
    DROP POLICY IF EXISTS waiter_calls_staff_update ON waiter_calls;
    DROP POLICY IF EXISTS "Public can create waiter calls" ON waiter_calls;
    DROP POLICY IF EXISTS "Public can view waiter calls" ON waiter_calls;
    DROP POLICY IF EXISTS "Staff can view and update waiter calls" ON waiter_calls;
    DROP POLICY IF EXISTS "Public and staff can view waiter calls" ON waiter_calls;
    DROP POLICY IF EXISTS "Public and staff can insert waiter calls" ON waiter_calls;
    DROP POLICY IF EXISTS "Staff can update waiter calls" ON waiter_calls;

    CREATE POLICY "Public and staff can view waiter calls" ON waiter_calls
      FOR SELECT TO public USING (true);

    CREATE POLICY "Public and staff can insert waiter calls" ON waiter_calls
      FOR INSERT TO public WITH CHECK (true);

    CREATE POLICY "Public and staff can update waiter calls" ON waiter_calls
      FOR UPDATE TO public USING (true) WITH CHECK (true);

    -- 2. PAYMENTS
    DROP POLICY IF EXISTS payments_counter_manage ON payments;
    DROP POLICY IF EXISTS payments_guest_insert ON payments;
    DROP POLICY IF EXISTS payments_guest_read ON payments;
    DROP POLICY IF EXISTS payments_staff_read ON payments;
    DROP POLICY IF EXISTS "Public and staff can view payments" ON payments;
    DROP POLICY IF EXISTS "Public and staff can insert payments" ON payments;
    DROP POLICY IF EXISTS "Staff can update payments" ON payments;

    CREATE POLICY "Public and staff can view payments" ON payments
      FOR SELECT TO public USING (true);

    CREATE POLICY "Public and staff can insert payments" ON payments
      FOR INSERT TO public WITH CHECK (true);

    CREATE POLICY "Public and staff can update payments" ON payments
      FOR UPDATE TO public USING (true) WITH CHECK (true);

    -- 3. RESTAURANT TABLES
    DROP POLICY IF EXISTS "Public and staff can update restaurant tables" ON restaurant_tables;
    CREATE POLICY "Public and staff can update restaurant tables" ON restaurant_tables
      FOR UPDATE TO public USING (true) WITH CHECK (true);

    -- 4. TABLE SESSIONS
    DROP POLICY IF EXISTS "Public and staff can view table sessions" ON table_sessions;
    DROP POLICY IF EXISTS "Public and staff can insert table sessions" ON table_sessions;
    DROP POLICY IF EXISTS "Public and staff can update table sessions" ON table_sessions;

    CREATE POLICY "Public and staff can view table sessions" ON table_sessions
      FOR SELECT TO public USING (true);

    CREATE POLICY "Public and staff can insert table sessions" ON table_sessions
      FOR INSERT TO public WITH CHECK (true);

    CREATE POLICY "Public and staff can update table sessions" ON table_sessions
      FOR UPDATE TO public USING (true) WITH CHECK (true);

    -- 5. ENSURE REPLICA IDENTITY FULL & PUBLICATION MEMBERSHIP
    ALTER TABLE waiter_calls REPLICA IDENTITY FULL;
    ALTER TABLE payments REPLICA IDENTITY FULL;
    ALTER TABLE restaurant_tables REPLICA IDENTITY FULL;
    ALTER TABLE table_sessions REPLICA IDENTITY FULL;
    ALTER TABLE kitchen_tickets REPLICA IDENTITY FULL;
    ALTER TABLE orders REPLICA IDENTITY FULL;
    ALTER TABLE order_items REPLICA IDENTITY FULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'waiter_calls'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE payments;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_tables'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'table_sessions'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
      END IF;
    END $$;
  `);

  console.log('Realtime and RLS policies successfully updated!');
  await client.end();
}

run().catch(console.error);
