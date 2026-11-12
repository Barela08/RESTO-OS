const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE tablename IN ('orders', 'order_items', 'kitchen_tickets');
  `);
  console.log('Policies:');
  res.rows.forEach(r => {
    console.log(`- ${r.tablename} | ${r.policyname} | ${r.cmd} | roles: ${r.roles}`);
  });
  await client.end();
}

run().catch(console.error);
