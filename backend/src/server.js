const app = require("./app");
const { pool } = require("./db");

const port = Number(process.env.PORT || 5001);

const server = app.listen(port, () => {
  console.log(`Hotube API server listening on http://localhost:${port}`);
});

const shutdown = async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
