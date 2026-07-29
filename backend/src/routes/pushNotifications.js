const express = require("express");
const {
  getPublicKey,
  getSubscriptionStatus,
  removeSubscription,
  saveSubscription,
  sendToUserIds,
} = require("../services/pushNotificationService");

const router = express.Router();

const sendError = (res, error, fallback) => res
  .status(error.status || 500)
  .json({ error: error.status ? error.message : fallback });

router.get("/push/vapid-public-key", (req, res) => {
  try {
    return res.json({ publicKey: getPublicKey() });
  } catch (error) {
    console.error("VAPID 공개키 조회 오류:", error);
    return res.status(500).json({ error: "푸시 알림 설정을 불러오지 못했습니다" });
  }
});

router.get("/push/status", async (req, res) => {
  try {
    if (!req.query.userId) return res.status(400).json({ error: "사용자 정보가 필요합니다" });
    return res.json(await getSubscriptionStatus(req.query.userId));
  } catch (error) {
    return sendError(res, error, "알림 상태를 불러오지 못했습니다");
  }
});

router.post("/push/subscribe", async (req, res) => {
  try {
    const result = await saveSubscription({
      userId: req.body.userId,
      subscription: req.body.subscription,
      userAgent: req.get("user-agent"),
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error("푸시 구독 저장 오류:", error);
    return sendError(res, error, "알림을 켜지 못했습니다");
  }
});

router.delete("/push/unsubscribe", async (req, res) => {
  try {
    if (!req.body.userId || !req.body.endpoint) {
      return res.status(400).json({ error: "구독 해제 정보가 필요합니다" });
    }
    return res.json(await removeSubscription({
      userId: req.body.userId,
      endpoint: req.body.endpoint,
    }));
  } catch (error) {
    return sendError(res, error, "알림을 끄지 못했습니다");
  }
});

router.post("/push/test", async (req, res) => {
  try {
    if (!req.body.userId) return res.status(400).json({ error: "사용자 정보가 필요합니다" });
    const result = await sendToUserIds([req.body.userId], {
      title: "HoTube 알림 테스트",
      body: "푸시 알림이 정상적으로 연결되었습니다.",
      url: "/mypage",
      tag: `test-${req.body.userId}`,
    });
    return res.json(result);
  } catch (error) {
    console.error("테스트 푸시 발송 오류:", error);
    return sendError(res, error, "테스트 알림을 보내지 못했습니다");
  }
});

module.exports = router;
