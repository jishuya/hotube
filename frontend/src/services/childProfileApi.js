const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const PROFILE_CACHE_MS = 5 * 60 * 1000;
const profileCaches = new Map();

const resolvePhotoUrl = (url) => {
  if (!url || /^(https?:|data:)/.test(url)) return url;
  return `${API_BASE_URL}${url}`;
};

const parseResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '아이 정보 요청에 실패했습니다.');
  return { ...data, profileImage: resolvePhotoUrl(data.profileImage) };
};

export const getChildProfile = async (slot = 0) => {
  const cache = profileCaches.get(slot) || {};
  if (Date.now() - cache.time < PROFILE_CACHE_MS) return cache.profile;
  if (cache.request) return cache.request;
  cache.request = fetch(`${API_BASE_URL}/childProfile?slot=${slot}`)
    .then(async (response) => {
      const profile = response.status === 404 ? null : await parseResponse(response);
      cache.profile = profile;
      cache.time = Date.now();
      return profile;
    })
    .finally(() => { cache.request = null; });
  profileCaches.set(slot, cache);
  return cache.request;
};

export const saveChildProfile = async (child, updatedBy, slot = 0) => {
  const response = await fetch(`${API_BASE_URL}/childProfile?slot=${slot}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: child.name,
      gender: child.gender,
      birthday: child.birthday,
      photoData: child.profileImage?.startsWith('data:image/') ? child.profileImage : null,
      updatedBy,
    }),
  });
  const saved = await parseResponse(response);
  profileCaches.set(slot, { profile: saved, time: Date.now() });
  return saved;
};
