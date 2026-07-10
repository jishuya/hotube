const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({
  path: path.resolve(__dirname, ".env"),
  quiet: true,
});

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5434),
  database: process.env.PGDATABASE || "hotube",
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PGCONNECTION_TIMEOUT_MS || 5000),
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
