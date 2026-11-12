const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'kitchen_ticket_items'
     ORDER BY ordinal_position`
  );
  console.log(`=== Table: kitchen_ticket_items ===`);
  res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));
  await client.end();
}

run().catch(console.error);
