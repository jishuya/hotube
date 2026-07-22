const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const throwApiError = async (response, fallback) => {
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error || fallback);
};

export const getDateAlbumTags = async ({ dateFrom, dateTo }) => {
  const params = new URLSearchParams({ dateFrom, dateTo });
  const response = await fetch(`${API_BASE_URL}/getDateAlbumTags?${params}`);
  if (!response.ok) return throwApiError(response, '날짜 태그를 불러오지 못했습니다');
  return response.json();
};

export const addDateAlbumTag = async (date, tag) => {
  const response = await fetch(`${API_BASE_URL}/addDateAlbumTag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, tag }),
  });
  if (!response.ok) return throwApiError(response, '날짜 태그를 추가하지 못했습니다');
  return response.json();
};

export const deleteDateAlbumTag = async (date, tag) => {
  const params = new URLSearchParams({ date, tag });
  const response = await fetch(`${API_BASE_URL}/deleteDateAlbumTag?${params}`, { method: 'DELETE' });
  if (!response.ok) return throwApiError(response, '날짜 태그를 삭제하지 못했습니다');
  return response.json();
};
