const fs = require("fs/promises");
const path = require("path");
const { pool } = require("../src/db");

const run = async () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../docs/postgresql/create_push_subscriptions.sql",
  );
  const sql = await fs.readFile(migrationPath, "utf8");
  await pool.query(sql);
  console.log("Push subscription schema is ready.");
};

run()
  .catch((error) => {
    console.error("Push subscription migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
