const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE tablename = 'orders';
  `);
  console.log('Orders policies:');
  res.rows.forEach(r => {
    console.log(`- ${r.policyname} | ${r.cmd} | roles: ${r.roles} | CHECK: ${r.with_check} | QUAL: ${r.qual}`);
  });
  await client.end();
}

run().catch(console.error);
