const { Client } = require('pg');

async function listTables() {
  const client = new Client({
    host: 'db.mklcrcyubohgfosgxmrm.supabase.co',
    port: 5432,
    user: 'postgres',
    password: process.env.PGPASSWORD || '',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables in public schema:', res.rows.map(r => r.table_name));
    await client.end();
  } catch (err) {
    console.error('Query failed:', err);
  }
}

listTables();
