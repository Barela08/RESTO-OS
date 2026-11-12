const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDatabaseConfig } = require('./query-helper.cjs');

async function run() {
  const client = new Client(getDatabaseConfig());
  await client.connect();

  const seedFile = path.join(__dirname, '..', 'supabase', 'seed.sql');
  let rawSql = fs.readFileSync(seedFile, 'utf8');

  // Strip single-line comments (-- ...)
  const lines = rawSql.split('\n');
  const cleanLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('--')) return '';
    return line;
  });
  const cleanSql = cleanLines.join('\n');

  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`\nExecuting ${statements.length} seed statements one by one...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const firstLine = stmt.split('\n')[0].substring(0, 60);
    try {
      await client.query(stmt);
      console.log(`[OK] Statement ${i + 1}: ${firstLine}...`);
    } catch (err) {
      console.error(`[FAIL] Statement ${i + 1}: ${firstLine}...`);
      console.error('Error detail:', err.message);
    }
  }

  // Count tables
  console.log('\n--- Checking Table Counts ---');
  const tables = [
    'restaurants',
    'restaurant_settings',
    'staff_roles',
    'profiles',
    'staff',
    'kitchen_stations',
    'restaurant_tables',
    'table_qr_tokens',
    'menu_categories',
    'menu_items',
    'menu_variants',
    'menu_addons',
    'suppliers',
    'inventory_items',
    'payment_settings',
    'voice_settings',
    'loyalty_programs',
    'shifts',
    'attendance'
  ];

  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*) FROM public.${t}`);
      console.log(`  public.${t}: ${res.rows[0].count}`);
    } catch (e) {
      console.log(`  public.${t}: error ${e.message}`);
    }
  }

  await client.end();
}

run().catch(console.error);
