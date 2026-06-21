// test-db-conn.js
// Run with: node test-db-conn.js
// Loads .env and attempts a pg Pool connect and simple query

require('dotenv').config();
const { Pool } = require('pg');

function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: url.port || 5432,
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
  };
}

const baseConfig = process.env.DATABASE_URL
  ? {
      ...parseDatabaseUrl(process.env.DATABASE_URL),
      ssl: { rejectUnauthorized: false },
      keepAlive: true,
      family: 4,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      keepAlive: true,
      family: 4,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
    };

console.log('Using DB config (redacted):', {
  host: baseConfig.host,
  port: baseConfig.port,
  database: baseConfig.database,
  user: baseConfig.user,
});

const pool = new Pool(baseConfig);

(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database successfully');
    const res = await client.query('SELECT now() as now, version() as version');
    console.log('Query result:', res.rows[0]);
    client.release();
  } catch (err) {
    console.error('❌ Connection error:');
    console.error(err);
  } finally {
    await pool.end();
  }
})();
