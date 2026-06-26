// database/db.js
// Shared PostgreSQL connection pool — imported by all routes

const dns = require("dns");
const { Pool } = require("pg");

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

function buildPoolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      keepAlive: true,
      family: 4,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
    };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    family: 4,
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 30000,
  };
}

const pool = new Pool(buildPoolConfig());

pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("📦 Database connected");
  }
});

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error:", err.message);
});

module.exports = pool;
