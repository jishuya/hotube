const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
