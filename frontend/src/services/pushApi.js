const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const NOTIFICATION_BASELINE_PREFIX = 'hotube_notification_baseline:';

export const getOrCreateNotificationBaseline = (userId) => {
  if (!userId) return null;
  const key = `${NOTIFICATION_BASELINE_PREFIX}${userId}`;
  const saved = localStorage.getItem(key);
  if (saved) return saved;
  const baseline = new Date().toISOString();
  localStorage.setItem(key, baseline);
  return baseline;
};

const authHeaders = () => {
  const token = JSON.parse(localStorage.getItem('hotube_user') || 'null')?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseResponse = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
};

export const getVapidPublicKey = async () => parseResponse(
  await fetch(`${API_BASE_URL}/push/vapid-public-key`, { headers: authHeaders() }),
  '알림 설정을 불러오지 못했습니다',
);

export const getPushStatus = async () => parseResponse(
  await fetch(`${API_BASE_URL}/push/status`, { headers: authHeaders() }),
  '알림 상태를 불러오지 못했습니다',
);

export const saveNotificationPreferences = async (preferences) => parseResponse(
  await fetch(`${API_BASE_URL}/push/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ preferences }),
  }),
  '상세 알림 설정을 저장하지 못했습니다',
);

export const getInternalNotifications = async () => parseResponse(
  await fetch(`${API_BASE_URL}/push/notifications`, { headers: authHeaders() }),
  '앱 알림을 불러오지 못했습니다',
);

export const markInternalNotificationRead = async (notificationId) => parseResponse(
  await fetch(`${API_BASE_URL}/push/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: authHeaders(),
  }),
  '알림을 확인 처리하지 못했습니다',
);

export const savePushSubscription = async (subscription) => parseResponse(
  await fetch(`${API_BASE_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ subscription }),
  }),
  '알림을 켜지 못했습니다',
);

export const removePushSubscription = async (endpoint) => parseResponse(
  await fetch(`${API_BASE_URL}/push/unsubscribe`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ endpoint }),
  }),
  '알림을 끄지 못했습니다',
);

export const sendTestPush = async () => parseResponse(
  await fetch(`${API_BASE_URL}/push/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({}),
  }),
  '테스트 알림을 보내지 못했습니다',
);

export const urlBase64ToUint8Array = (value) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
};

export const enablePushOnCurrentDevice = async () => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 허용되지 않았습니다. 기기 설정에서 HoTube 알림을 허용해주세요.');
  }
  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await getVapidPublicKey();
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let existing = await registration.pushManager.getSubscription();
  const existingKey = existing?.options?.applicationServerKey;
  if (existing && existingKey) {
    const savedKey = new Uint8Array(existingKey);
    const sameKey = savedKey.length === applicationServerKey.length
      && savedKey.every((value, index) => value === applicationServerKey[index]);
    if (!sameKey) {
      await existing.unsubscribe();
      existing = null;
    }
  }
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
  await savePushSubscription(subscription.toJSON());
  return subscription;
};

export const disablePushOnCurrentDevice = async (knownSubscription = null) => {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = knownSubscription
    || await registration?.pushManager?.getSubscription();
  if (!subscription) return;

  const results = await Promise.allSettled([
    removePushSubscription(subscription.endpoint),
    subscription.unsubscribe(),
  ]);
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected) throw rejected.reason;
};

export const clearAppBadge = async () => {
  if ('clearAppBadge' in navigator) {
    await navigator.clearAppBadge();
  } else if ('setAppBadge' in navigator) {
    await navigator.setAppBadge(0);
  }
};

export const dismissMediaNotifications = async (mediaIds) => {
  if (!('serviceWorker' in navigator)) return;

  const ids = new Set((mediaIds || []).filter(Boolean).map(String));
  if (ids.size === 0) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.getNotifications) return;

    const notifications = await registration.getNotifications();
    notifications.forEach((notification) => {
      const mediaId = notification.tag?.startsWith('media-')
        ? notification.tag.slice('media-'.length)
        : null;
      if (mediaId && ids.has(mediaId)) notification.close();
    });
  } catch (error) {
    console.error('확인한 미디어의 시스템 알림 닫기 실패:', error);
  }
};
