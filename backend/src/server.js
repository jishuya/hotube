const app = require("./app");
const { pool } = require("./db");
const { ensurePushSubscriptionSchema } = require("./services/pushNotificationService");
const { resumeMediaProcessing } = require('./services/mediaProcessingService');

const port = Number(process.env.PORT || 5001);

let server;

const start = async () => {
  if (!process.env.AUTH_TOKEN_SECRET) {
    throw new Error("AUTH_TOKEN_SECRET 환경변수가 필요합니다");
  }
  await ensurePushSubscriptionSchema();
  await resumeMediaProcessing();
  server = app.listen(port, () => {
    console.log(`Hotube API server listening on http://localhost:${port}`);
  });
};

start().catch(async (error) => {
  console.error("Hotube API server startup failed:", error);
  await pool.end();
  process.exit(1);
});

const shutdown = async () => {
  if (!server) {
    await pool.end();
    process.exit(0);
  }
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
