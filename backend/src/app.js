const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const videoRoutes = require("./routes/videos");
const authRoutes = require("./routes/auth");
const interactionRoutes = require("./routes/interactions");
const commentRoutes = require("./routes/comments");
const childProfileRoutes = require("./routes/childProfiles");
const memoryDateRoutes = require('./routes/memoryDates');
const userAlbumRoutes = require('./routes/userAlbums');
const supportRoutes = require('./routes/support');
const pushNotificationRoutes = require('./routes/pushNotifications');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "8mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Hotube API 서버 실행 중" });
});

app.use(videoRoutes);
app.use(authRoutes);
app.use(interactionRoutes);
app.use(commentRoutes);
app.use(childProfileRoutes);
app.use(memoryDateRoutes);
app.use(userAlbumRoutes);
app.use(supportRoutes);
app.use(pushNotificationRoutes);

const frontendDist = path.resolve(__dirname, "../../frontend/dist");

if (fs.existsSync(frontendDist)) {
  const sendPwaFile = (filename, contentType) => (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.type(contentType);
    return res.sendFile(path.join(frontendDist, filename));
  };

  app.get("/sw.js", sendPwaFile("sw.js", "application/javascript"));
  app.get(
    "/manifest.webmanifest",
    sendPwaFile("manifest.webmanifest", "application/manifest+json"),
  );
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (!req.accepts("html")) {
      return next();
    }

    return res.sendFile(path.join(frontendDist, "index.html"));
  });
}

module.exports = app;
