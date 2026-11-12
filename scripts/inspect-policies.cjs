const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  res.rows.forEach(r => {
    console.log(`${r.tablename.padEnd(25)} | ${r.cmd.padEnd(8)} | ${r.roles} | ${r.policyname}`);
  });
  await client.end();
}

run().catch(console.error);
