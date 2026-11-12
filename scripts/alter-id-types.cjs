const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Altering id columns to character varying(100)...');

  await client.query(`
    -- waiter_calls
    ALTER TABLE waiter_calls ALTER COLUMN id TYPE character varying(100);

    -- Drop FK constraints referencing orders.id
    ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
    ALTER TABLE kitchen_tickets DROP CONSTRAINT IF EXISTS kitchen_tickets_order_id_fkey;
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
    ALTER TABLE kitchen_ticket_items DROP CONSTRAINT IF EXISTS kitchen_ticket_items_kitchen_ticket_id_fkey;
    ALTER TABLE kitchen_ticket_items DROP CONSTRAINT IF EXISTS kitchen_ticket_items_order_item_id_fkey;

    -- Alter orders and related tables
    ALTER TABLE orders ALTER COLUMN id TYPE character varying(100);
    ALTER TABLE order_items ALTER COLUMN id TYPE character varying(100);
    ALTER TABLE order_items ALTER COLUMN order_id TYPE character varying(100);

    ALTER TABLE kitchen_tickets ALTER COLUMN id TYPE character varying(100);
    ALTER TABLE kitchen_tickets ALTER COLUMN order_id TYPE character varying(100);

    ALTER TABLE kitchen_ticket_items ALTER COLUMN id TYPE character varying(100);
    ALTER TABLE kitchen_ticket_items ALTER COLUMN kitchen_ticket_id TYPE character varying(100);
    ALTER TABLE kitchen_ticket_items ALTER COLUMN order_item_id TYPE character varying(100);

    ALTER TABLE payments ALTER COLUMN id TYPE character varying(100);
    ALTER TABLE payments ALTER COLUMN order_id TYPE character varying(100);

    -- Re-add FK constraints
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

    ALTER TABLE kitchen_tickets
      ADD CONSTRAINT kitchen_tickets_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

    ALTER TABLE payments
      ADD CONSTRAINT payments_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

    ALTER TABLE kitchen_ticket_items
      ADD CONSTRAINT kitchen_ticket_items_kitchen_ticket_id_fkey
      FOREIGN KEY (kitchen_ticket_id) REFERENCES kitchen_tickets(id) ON DELETE CASCADE;

    ALTER TABLE kitchen_ticket_items
      ADD CONSTRAINT kitchen_ticket_items_order_item_id_fkey
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE;
  `);

  console.log('Successfully altered ID columns to character varying(100)!');
  await client.end();
}

run().catch(console.error);
