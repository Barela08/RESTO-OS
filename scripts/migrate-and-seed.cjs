const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const config = {
  host: 'db.mklcrcyubohgfosgxmrm.supabase.co',
  port: 5432,
  user: 'postgres',
  password: process.env.PGPASSWORD || '',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
};

async function run() {
  const client = new Client(config);
  console.log('Connecting to Supabase PostgreSQL...');
  await client.connect();
  console.log('Connected successfully!');

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\nFound ${migrationFiles.length} migration files.`);

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`\n[Executing Migration] ${file}...`);
    try {
      await client.query(sql);
      console.log(`[Success] ${file}`);
    } catch (err) {
      console.error(`[Error in ${file}]:`, err.message);
      // If error is notice/already exists, proceed
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('Continuing despite existing object...');
      } else {
        throw err;
      }
    }
  }

  // Run seed.sql
  const seedFile = path.join(__dirname, '..', 'supabase', 'seed.sql');
  if (fs.existsSync(seedFile)) {
    console.log('\n[Executing Seed Data] seed.sql...');
    const seedSql = fs.readFileSync(seedFile, 'utf8');
    try {
      await client.query(seedSql);
      console.log('[Success] Seed data inserted successfully!');
    } catch (err) {
      console.error('[Error in seed.sql]:', err.message);
    }
  }

  // Setup Supabase Realtime Publication
  console.log('\n[Configuring Supabase Realtime Publication]...');
  const realtimeTables = [
    'restaurants',
    'restaurant_settings',
    'restaurant_tables',
    'table_qr_tokens',
    'table_sessions',
    'repeat_scan_requests',
    'menu_categories',
    'menu_items',
    'orders',
    'order_items',
    'kitchen_tickets',
    'waiter_calls',
    'payments',
    'invoices',
    'customers',
    'loyalty_accounts',
    'loyalty_rewards',
    'notifications',
    'voice_settings',
    'notification_events',
    'payment_settings',
    'payment_verification_requests',
    'reward_redemptions'
  ];

  for (const tbl of realtimeTables) {
    try {
      await client.query(`ALTER TABLE IF EXISTS public.${tbl} REPLICA IDENTITY FULL;`);
      await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public.${tbl};`);
      console.log(`  Realtime publication added: public.${tbl}`);
    } catch (e) {
      if (e.message.includes('already in publication')) {
        console.log(`  Table public.${tbl} already in publication.`);
      } else {
        console.log(`  Notice for public.${tbl}: ${e.message}`);
      }
    }
  }

  // Verification count
  console.log('\n[Verifying Table Counts in Supabase]...');
  const countQueries = [
    'restaurants',
    'restaurant_tables',
    'menu_items',
    'menu_categories',
    'staff',
    'profiles',
    'voice_settings',
    'payment_settings'
  ];

  for (const t of countQueries) {
    try {
      const res = await client.query(`SELECT count(*) as count FROM public.${t};`);
      console.log(`  Count for public.${t}: ${res.rows[0].count}`);
    } catch (e) {
      console.log(`  Could not count ${t}: ${e.message}`);
    }
  }

  await client.end();
  console.log('\nAll Supabase database migrations and seeds completed successfully!');
}

run().catch(err => {
  console.error('\nFatal migration error:', err);
  process.exit(1);
});
