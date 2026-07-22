const express = require("express");
const cors = require("cors");
const videoRoutes = require("./routes/videos");
const authRoutes = require("./routes/auth");
const interactionRoutes = require("./routes/interactions");
const commentRoutes = require("./routes/comments");
const childProfileRoutes = require("./routes/childProfiles");
const dateAlbumTagRoutes = require('./routes/dateAlbumTags');

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

module.exports = app;
