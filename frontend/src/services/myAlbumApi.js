const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const readError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  throw new Error(data.error || fallback);
};

const addViewerToCover = (album, userId) => {
  const coverUrl = album.coverThumbnailUrl;
  if (!coverUrl || /^https?:/.test(coverUrl)) return album;
  const separator = coverUrl.includes('?') ? '&' : '?';
  return {
    ...album,
    coverThumbnailUrl: `${API_BASE_URL}${coverUrl}${separator}viewerId=${encodeURIComponent(userId)}`,
  };
};

const resolveMedia = (media, userId) => {
  const resolveUrl = (value) => {
    if (!value || /^(https?:|data:|blob:)/.test(value)) return value;
    const separator = value.includes('?') ? '&' : '?';
    return `${API_BASE_URL}${value}${separator}viewerId=${encodeURIComponent(userId)}`;
  };
  return {
    ...media,
    fileUrl: resolveUrl(media.fileUrl),
    thumbnailUrl: resolveUrl(media.thumbnailUrl),
  };
};

export const getMyAlbums = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/getMyAlbums?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) return readError(response, '앨범 목록을 가져오지 못했습니다');
  return (await response.json()).map((album) => addViewerToCover(album, userId));
};

export const getMyAlbum = async (userId, albumId) => {
  const response = await fetch(
    `${API_BASE_URL}/getMyAlbum/${encodeURIComponent(albumId)}?userId=${encodeURIComponent(userId)}`,
  );
  if (!response.ok) return readError(response, '앨범을 가져오지 못했습니다');
  return addViewerToCover(await response.json(), userId);
};

export const getMyAlbumMedia = async (userId, albumId) => {
  const response = await fetch(
    `${API_BASE_URL}/getMyAlbumMedia/${encodeURIComponent(albumId)}?userId=${encodeURIComponent(userId)}`,
  );
  if (!response.ok) return readError(response, '앨범의 미디어를 가져오지 못했습니다');
  return (await response.json()).map((media) => resolveMedia(media, userId));
};

export const createMyAlbum = async (userId, { title, description = '' }) => {
  const response = await fetch(`${API_BASE_URL}/createMyAlbum`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title, description }),
  });
  if (!response.ok) return readError(response, '앨범을 만들지 못했습니다');
  return addViewerToCover(await response.json(), userId);
};

export const updateMyAlbum = async (userId, albumId, updates) => {
  const response = await fetch(`${API_BASE_URL}/updateMyAlbum/${encodeURIComponent(albumId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...updates }),
  });
  if (!response.ok) return readError(response, '앨범을 수정하지 못했습니다');
  return addViewerToCover(await response.json(), userId);
};

export const deleteMyAlbum = async (userId, albumId) => {
  const response = await fetch(
    `${API_BASE_URL}/deleteMyAlbum/${encodeURIComponent(albumId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) return readError(response, '앨범을 삭제하지 못했습니다');
  return response.json();
};

export const addMediaToMyAlbum = async (userId, albumId, mediaIds) => {
  const response = await fetch(`${API_BASE_URL}/addMediaToMyAlbum/${encodeURIComponent(albumId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, mediaIds }),
  });
  if (!response.ok) return readError(response, '앨범에 미디어를 담지 못했습니다');
  return response.json();
};

export const removeMediaFromMyAlbum = async (userId, albumId, mediaIds) => {
  const response = await fetch(`${API_BASE_URL}/removeMediaFromMyAlbum/${encodeURIComponent(albumId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, mediaIds }),
  });
  if (!response.ok) return readError(response, '앨범에서 미디어를 빼지 못했습니다');
  return response.json();
};
