const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const videoRoutes = require("./routes/videos");
const authRoutes = require("./routes/auth");
const interactionRoutes = require("./routes/interactions");
const commentRoutes = require("./routes/comments");
const childProfileRoutes = require("./routes/childProfiles");
const dateAlbumTagRoutes = require('./routes/dateAlbumTags');
const userAlbumRoutes = require('./routes/userAlbums');
const supportRoutes = require('./routes/support');

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
app.use(dateAlbumTagRoutes);
app.use(userAlbumRoutes);
app.use(supportRoutes);

const frontendDist = path.resolve(__dirname, "../../frontend/dist");

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (!req.accepts("html")) {
      return next();
    }

    return res.sendFile(path.join(frontendDist, "index.html"));
  });
}

module.exports = app;
