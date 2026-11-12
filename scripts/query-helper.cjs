const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  // Parse local .env if available
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        const val = trimmed.substring('DATABASE_URL='.length).trim();
        return {
          connectionString: val,
          ssl: { rejectUnauthorized: false },
        };
      }
    }
  }

  throw new Error('DATABASE_URL environment variable is required to execute PostgreSQL operations.');
}

async function executeSql(sql, params = []) {
  const config = getDatabaseConfig();
  const client = new Client(config);

  try {
    await client.connect();
    const res = await client.query(sql, params);
    return res;
  } finally {
    await client.end();
  }
}

module.exports = { executeSql, getDatabaseConfig };

if (require.main === module) {
  const query = process.argv[2] || 'SELECT current_database(), current_user, version()';
  executeSql(query)
    .then(r => {
      console.log('Query result:');
      console.log(r.rows);
    })
    .catch(err => {
      console.error('Query error:', err);
      process.exit(1);
    });
}
