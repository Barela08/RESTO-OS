const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'db.mklcrcyubohgfosgxmrm.supabase.co',
    port: 5432,
    user: 'postgres',
    password: process.env.PGPASSWORD || '',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to Supabase PostgreSQL at db.mklcrcyubohgfosgxmrm.supabase.co:5432 ...');
    await client.connect();
    const res = await client.query('SELECT NOW() as current_time, version();');
    console.log('Connection successful!');
    console.log('Current time in database:', res.rows[0].current_time);
    console.log('PostgreSQL version:', res.rows[0].version);
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

testConnection();
