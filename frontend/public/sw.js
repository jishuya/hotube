const DEFAULT_NOTIFICATION = {
  title: "HoTube",
  body: "새로운 소식이 있습니다.",
  url: "/",
  tag: "hotube",
  icon: "/logo.png",
  badge: "/logo.png",
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

  event.waitUntil(Promise.all([
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url },
    }),
    "setAppBadge" in self.navigator ? self.navigator.setAppBadge(1) : Promise.resolve(),
  ]));
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
