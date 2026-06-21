// database/db.js
// Shared PostgreSQL connection pool — imported by all routes

const dns = require("dns");
const { Pool } = require("pg");

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

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

const pool = new Pool(
  process.env.DATABASE_URL
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
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        family: 4,
        connectionTimeoutMillis: 20000,
        idleTimeoutMillis: 30000,
      }
);

pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("📦 Database connected");
  }
});

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error:", err.message);
});

module.exports = pool;
