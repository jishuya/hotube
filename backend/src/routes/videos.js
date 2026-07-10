const express = require("express");
const { mapMediaRowToVideo } = require("../responseMappers");
const {
  createMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} = require("../services/mediaService");

const router = express.Router();

const sendRouteError = (res, fallbackMessage, error) => {
  if (error.status) {
    return res.status(error.status).json({ error: error.message });
  }

  return res.status(500).json({ error: fallbackMessage });
};

router.get("/getVideos", async (req, res) => {
  try {
    const videos = await listMedia();
    res.json(videos.map(mapMediaRowToVideo));
  } catch (error) {
    console.error("비디오 조회 오류:", error);
    sendRouteError(res, "비디오 조회 실패", error);
  }
});

router.get("/getVideo/:id", async (req, res) => {
  try {
    const video = await getMedia(req.params.id);
    res.json(mapMediaRowToVideo(video));
  } catch (error) {
    console.error("비디오 조회 오류:", error);
    sendRouteError(res, "비디오 조회 실패", error);
  }
});

router.post("/createVideo", async (req, res) => {
  try {
    const createdVideo = await createMedia(req.body);
    res.status(201).json(mapMediaRowToVideo(createdVideo));
  } catch (error) {
    console.error("비디오 등록 오류:", error);
    sendRouteError(res, "비디오 등록 실패", error);
  }
});

router.put("/updateVideo/:id", async (req, res) => {
  try {
    const updatedVideo = await updateMedia(req.params.id, req.body);
    res.json(mapMediaRowToVideo(updatedVideo));
  } catch (error) {
    console.error("비디오 수정 오류:", error);
    sendRouteError(res, "비디오 수정 실패", error);
  }
});

router.delete("/deleteVideo/:id", async (req, res) => {
  try {
    await deleteMedia(req.params.id);
    res.json({ message: "비디오가 삭제되었습니다", id: req.params.id });
  } catch (error) {
    console.error("비디오 삭제 오류:", error);
    sendRouteError(res, "비디오 삭제 실패", error);
  }
});

module.exports = router;
