const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const { performance } = require("perf_hooks");

const envPaths = [path.resolve(__dirname, "../.env")];

const envPath = envPaths.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath, quiet: true });
}

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

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 250);
const TIMED_CLIENT = Symbol('hotubeTimedClient');

const summarizeQuery = (config) => {
  const sql = typeof config === 'string' ? config : config?.text;
  return String(sql || '').replace(/\s+/g, ' ').trim().slice(0, 180);
};

const runTimedQuery = async (query, args) => {
  const startedAt = performance.now();
  try {
    return await query(...args);
  } finally {
    const duration = performance.now() - startedAt;
    if (duration >= SLOW_QUERY_MS) {
      console.warn(JSON.stringify({
        type: 'slow-db-query',
        durationMs: Math.round(duration),
        query: summarizeQuery(args[0]),
      }));
    }
  }
};

const getClient = async () => {
  const client = await pool.connect();
  if (!client[TIMED_CLIENT]) {
    const query = client.query.bind(client);
    client.query = (...args) => runTimedQuery(query, args);
    client[TIMED_CLIENT] = true;
  }
  return client;
};

module.exports = {
  pool,
  query: (...args) => runTimedQuery(pool.query.bind(pool), args),
  getClient,
};
