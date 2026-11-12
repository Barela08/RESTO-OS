const { Client } = require('pg');
const { getDatabaseConfig } = require('./query-helper.cjs');

const client = new Client(getDatabaseConfig());

async function run() {
  await client.connect();

  console.log('=== 1. Public Tables & Row Counts ===');
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  for (const row of tablesRes.rows) {
    try {
      const countRes = await client.query(`SELECT count(*) FROM public."${row.table_name}"`);
      console.log(`- ${row.table_name}: ${countRes.rows[0].count} rows`);
    } catch (e) {
      console.log(`- ${row.table_name}: error reading count: ${e.message}`);
    }
  }

  console.log('\n=== 2. Existing Policies on Tables ===');
  const polRes = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);
  console.log(`Found ${polRes.rows.length} policies.`);
  const polMap = {};
  for (const p of polRes.rows) {
    if (!polMap[p.tablename]) polMap[p.tablename] = [];
    polMap[p.tablename].push(p.policyname);
  }
  for (const t of Object.keys(polMap)) {
    console.log(`  Table [${t}] (${polMap[t].length}): ${polMap[t].join(', ')}`);
  }

  console.log('\n=== 3. Search Path of Functions ===');
  const spRes = await client.query(`
    SELECT proname, prosecdef, proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public';
  `);
  for (const p of spRes.rows) {
    const hasSearchPath = p.proconfig && p.proconfig.some(c => c.startsWith('search_path='));
    console.log(`  ${p.proname}: secdef=${p.prosecdef}, search_path=${hasSearchPath ? p.proconfig : 'MUTABLE/UNSET'}`);
  }

  await client.end();
}

run().catch(console.error);
