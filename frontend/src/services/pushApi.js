const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const parseResponse = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
};

export const getVapidPublicKey = async () => parseResponse(
  await fetch(`${API_BASE_URL}/push/vapid-public-key`),
  '알림 설정을 불러오지 못했습니다',
);

export const savePushSubscription = async (userId, subscription) => parseResponse(
  await fetch(`${API_BASE_URL}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subscription }),
  }),
  '알림을 켜지 못했습니다',
);

export const removePushSubscription = async (userId, endpoint) => parseResponse(
  await fetch(`${API_BASE_URL}/push/unsubscribe`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, endpoint }),
  }),
  '알림을 끄지 못했습니다',
);

export const sendTestPush = async (userId) => parseResponse(
  await fetch(`${API_BASE_URL}/push/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  }),
  '테스트 알림을 보내지 못했습니다',
);
