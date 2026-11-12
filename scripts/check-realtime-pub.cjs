const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:@db.mklcrcyubohgfosgxmrm.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime';
  `);
  console.log('Tables in supabase_realtime publication:', res.rows.map(r => r.tablename));

  // Also check if publication exists
  const pub = await client.query(`SELECT pubname FROM pg_publication WHERE pubname = 'supabase_realtime'`);
  console.log('Publication exists:', pub.rows);

  await client.end();
}

run().catch(console.error);
