const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
  const response = await fetch(`${API_BASE_URL}/childProfile`);
  if (response.status === 404) return null;
  return parseResponse(response);
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
  return parseResponse(response);
};
