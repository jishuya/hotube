const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const throwApiError = async (response, fallback) => {
  const body = await response.json().catch(() => ({}));
  throw new Error(body.error || fallback);
};

export const getMemoryDateNotes = async ({ dateFrom, dateTo }, userId) => {
  const params = new URLSearchParams({ dateFrom, dateTo, userId });
  const response = await fetch(`${API_BASE_URL}/memoryDateNotes?${params}`);
  if (!response.ok) return throwApiError(response, '날짜 메모를 불러오지 못했습니다');
  return response.json();
};

export const saveMemoryDateNote = async (date, content, userId) => {
  const response = await fetch(`${API_BASE_URL}/memoryDateNotes/${encodeURIComponent(date)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, userId }),
  });
  if (!response.ok) return throwApiError(response, '날짜 메모를 저장하지 못했습니다');
  return response.json();
};

export const deleteMemoryDateNote = async (date, userId) => {
  const params = new URLSearchParams({ userId });
  const response = await fetch(`${API_BASE_URL}/memoryDateNotes/${encodeURIComponent(date)}?${params}`, {
    method: 'DELETE',
  });
  if (!response.ok) return throwApiError(response, '날짜 메모를 삭제하지 못했습니다');
  return response.json();
};

export const addTagsToDateMedia = async (date, tags, userId) => {
  const response = await fetch(`${API_BASE_URL}/memoryDates/${encodeURIComponent(date)}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags, userId }),
  });
  if (!response.ok) return throwApiError(response, '사진에 태그를 추가하지 못했습니다');
  return response.json();
};
