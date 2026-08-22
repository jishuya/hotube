const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const PROFILE_CACHE_MS = 5 * 60 * 1000;
let profileCache = null;
let profileCacheTime = 0;
let profileRequest = null;

const resolvePhotoUrl = (url) => {
  if (!url || /^(https?:|data:)/.test(url)) return url;
  return `${API_BASE_URL}${url}`;
};

const parseResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '아이 정보 요청에 실패했습니다.');
  return { ...data, profileImage: resolvePhotoUrl(data.profileImage) };
};

export const getChildProfile = async () => {
  if (Date.now() - profileCacheTime < PROFILE_CACHE_MS) return profileCache;
  if (profileRequest) return profileRequest;
  profileRequest = fetch(`${API_BASE_URL}/childProfile`)
    .then(async (response) => {
      const profile = response.status === 404 ? null : await parseResponse(response);
      profileCache = profile;
      profileCacheTime = Date.now();
      return profile;
    })
    .finally(() => {
      profileRequest = null;
    });
  return profileRequest;
};

export const saveChildProfile = async (child, updatedBy) => {
  const response = await fetch(`${API_BASE_URL}/childProfile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: child.name,
      nickname: child.nickname,
      gender: child.gender,
      birthday: child.birthday,
      photoData: child.profileImage?.startsWith('data:image/') ? child.profileImage : null,
      updatedBy,
    }),
  });
  const saved = await parseResponse(response);
  profileCache = saved;
  profileCacheTime = Date.now();
  return saved;
};
