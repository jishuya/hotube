const DEFAULT_NOTIFICATION = {
  title: "HoTube",
  body: "새로운 소식이 있습니다.",
  url: "/",
  tag: "hotube",
  icon: "/logo.png",
  badge: "/logo.png",
};

const BADGE_STATE_CACHE = "hotube-badge-state-v1";
const BADGE_STATE_URL = new URL("/__hotube_badge_state__", self.location.origin).href;

const updateAppBadge = async ({ badgeCount, badgeVersion = 0 }) => {
  if (!Number.isInteger(badgeCount) || badgeCount < 0) return;

  const cache = await caches.open(BADGE_STATE_CACHE);
  const savedResponse = await cache.match(BADGE_STATE_URL);
  const savedState = await savedResponse?.json().catch(() => null);
  const nextVersion = Number.isFinite(badgeVersion) ? badgeVersion : 0;
  if (nextVersion > 0 && nextVersion < (savedState?.version || 0)) return;

  if (badgeCount === 0 && "clearAppBadge" in self.navigator) {
    await self.navigator.clearAppBadge();
  } else if ("setAppBadge" in self.navigator) {
    await self.navigator.setAppBadge(badgeCount);
  }
  await cache.put(BADGE_STATE_URL, new Response(JSON.stringify({
    count: badgeCount,
    version: nextVersion,
  }), { headers: { "Content-Type": "application/json" } }));
};

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = DEFAULT_NOTIFICATION;
  try {
    payload = { ...DEFAULT_NOTIFICATION, ...(event.data?.json() || {}) };
  } catch {
    payload = { ...DEFAULT_NOTIFICATION, body: event.data?.text() || DEFAULT_NOTIFICATION.body };
  }

  const badgePromise = updateAppBadge(payload);

  event.waitUntil(Promise.all([
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url },
    }),
    badgePromise,
  ]));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SYNC_APP_BADGE") return;
  event.waitUntil(updateAppBadge({
    badgeCount: event.data.badgeCount,
    badgeVersion: event.data.badgeVersion,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existingWindow = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existingWindow) {
      await existingWindow.navigate(targetUrl);
      return existingWindow.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
