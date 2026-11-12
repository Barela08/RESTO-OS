const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDatabaseConfig } = require('./query-helper.cjs');

async function run() {
  const client = new Client(getDatabaseConfig());

  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20261112000002_secure_rls_and_functions.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('Applying migration 20261112000002_secure_rls_and_functions.sql...');
  await client.query(sql);
  console.log('Migration 20261112000002_secure_rls_and_functions.sql applied successfully!');

  // Verify search path of all functions
  const spRes = await client.query(`
    SELECT proname, prosecdef, proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public';
  `);
  console.log('\n--- Function Search Paths After Migration ---');
  for (const p of spRes.rows) {
    console.log(`  ${p.proname}: secdef=${p.prosecdef}, config=${JSON.stringify(p.proconfig)}`);
  }

  // Verify RLS policy counts
  const polRes = await client.query(`
    SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
  `);
  console.log(`\nTotal public policies now: ${polRes.rows[0].count}`);

  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
