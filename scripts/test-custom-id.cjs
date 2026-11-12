const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    INSERT INTO waiter_calls (id, restaurant_id, table_id, request_type, status, notes)
    VALUES ('call-test-999', 'rest-001-main', 'c0000001-0000-0000-0000-000000000005', 'CALL_WAITER', 'REQUESTED', 'Test insert')
    RETURNING id;
  `);
  console.log('Inserted call with custom ID:', res.rows[0].id);
  await client.query("DELETE FROM waiter_calls WHERE id = 'call-test-999'");
  console.log('Deleted test call cleanly.');
  await client.end();
}

run().catch(console.error);
