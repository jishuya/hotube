import { uploadRequest, retryUploadChunk } from './uploadTransport.js';
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');

const FUNCTIONS_URL = {
  getVideos: `${API_BASE_URL}/getVideos`,
  getVideo: `${API_BASE_URL}/getVideo`,
  createVideo: `${API_BASE_URL}/createVideo`,
  updateVideo: `${API_BASE_URL}/updateVideo`,
  deleteVideo: `${API_BASE_URL}/deleteVideo`,
  deleteMediaByDate: `${API_BASE_URL}/deleteMediaByDate`,
  uploadMedia: `${API_BASE_URL}/uploadMedia`,
  initMediaUpload: `${API_BASE_URL}/uploadMedia/init`,
  checkMediaDuplicates: `${API_BASE_URL}/checkMediaDuplicates`,
  getMediaDateRange: `${API_BASE_URL}/getMediaDateRange`,
  getCalendarMedia: `${API_BASE_URL}/getCalendarMedia`,
  getMediaDetails: `${API_BASE_URL}/getMediaDetails`,
  getFavoriteMedia: `${API_BASE_URL}/getFavoriteMedia`,
  getLikedMedia: `${API_BASE_URL}/getLikedMedia`,
  toggleFavorite: `${API_BASE_URL}/toggleFavorite`,
};
const DETAILS_CACHE_MS = 15 * 1000;
const detailsCache = new Map();

export const checkMediaDuplicates = async (hashes, signal) => {
  const data = await uploadRequest(FUNCTIONS_URL.checkMediaDuplicates, { body: { hashes }, signal, timeout: 30000 });
  return data.duplicateHashes || [];
};

const getViewerId = () => {
  try {
    return JSON.parse(localStorage.getItem('hotube_user'))?.id || '';
  } catch {
    return '';
  }
};

const addViewerQuery = (value) => {
  if (!value || /^(data:|blob:)/.test(value)) return value;
  const viewerId = getViewerId();
  if (!viewerId || /^https?:/.test(value)) return value;
  return `${value}${value.includes('?') ? '&' : '?'}viewerId=${encodeURIComponent(viewerId)}`;
};

const resolveApiUrl = (value) => {
  if (!value || /^(https?:|data:|blob:)/.test(value)) return value;
  return `${API_BASE_URL}${value}`;
};

const resolveMediaUrls = (media) => ({
  ...media,
  fileUrl: resolveApiUrl(addViewerQuery(media.fileUrl)),
  thumbnailUrl: resolveApiUrl(addViewerQuery(media.thumbnailUrl)),
  previewUrl: resolveApiUrl(addViewerQuery(media.previewUrl)),
});

export const toMemoryMedia = (media) => ({
  ...media,
  date: media.uploadedAt,
  type: media.mediaType === 'photo' ? 'photo' : 'video',
  videoType: media.type,
  source: media.mediaType === 'youtube' ? 'youtube' : 'file',
  src: media.mediaType === 'youtube' ? media.youtubeUrl : media.fileUrl,
  thumbnail: media.thumbnailUrl || (media.mediaType === 'photo' ? media.fileUrl : null),
  preview: media.previewUrl || media.thumbnailUrl || (media.mediaType === 'photo' ? media.fileUrl : null),
});

// 모든 비디오 조회
export const getAllVideos = async (filters = null) => {
  const normalizedFilters = typeof filters === 'string' ? { contentType: filters } : (filters || {});
  const searchParams = new URLSearchParams();
  searchParams.set('viewerId', getViewerId());
  Object.entries(normalizedFilters).forEach(([key, value]) => {
    if (value && value !== 'all') searchParams.set(key, value);
  });
  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  const response = await fetch(`${FUNCTIONS_URL.getVideos}${query}`);

  if (!response.ok) {
    throw new Error('비디오 목록을 가져오는데 실패했습니다');
  }

  return (await response.json()).map(resolveMediaUrls);
};

export const getMediaPage = async (filters = {}, cursor = null) => {
  const searchParams = new URLSearchParams();
  searchParams.set('viewerId', getViewerId());
  searchParams.set('pagination', 'cursor');
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') searchParams.set(key, value);
  });
  if (cursor) searchParams.set('cursor', cursor);
  const response = await fetch(`${FUNCTIONS_URL.getVideos}?${searchParams.toString()}`);
  if (!response.ok) throw new Error('미디어 목록을 가져오는데 실패했습니다');
  const page = await response.json();
  return {
    items: (page.items || []).map(resolveMediaUrls),
    nextCursor: page.nextCursor || null,
  };
};

export const getMediaDateRange = async () => {
  const response = await fetch(FUNCTIONS_URL.getMediaDateRange);
  if (!response.ok) throw new Error('미디어 날짜 범위를 가져오는데 실패했습니다');
  return response.json();
};

export const getCalendarMedia = async () => {
  const response = await fetch(
    `${FUNCTIONS_URL.getCalendarMedia}?viewerId=${encodeURIComponent(getViewerId())}`,
  );
  if (!response.ok) throw new Error('캘린더 미디어를 가져오는데 실패했습니다');
  const calendar = await response.json();
  return {
    dates: calendar.dates || [],
    unreadMedia: (calendar.unreadMedia || []).map(resolveMediaUrls),
    notificationMedia: (calendar.notificationMedia || []).map(resolveMediaUrls),
  };
};

// 단일 비디오 조회
export const getVideoById = async (id) => {
  const response = await fetch(`${FUNCTIONS_URL.getVideo}/${id}?viewerId=${encodeURIComponent(getViewerId())}`);

  if (!response.ok) {
    throw new Error('비디오를 찾을 수 없습니다');
  }

  return resolveMediaUrls(await response.json());
};

// 비디오 등록
export const addVideo = async (videoData, { signal } = {}) => {
  const response = await fetch(FUNCTIONS_URL.createVideo, {
    signal,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(videoData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '비디오 등록에 실패했습니다');
  }

  return resolveMediaUrls(await response.json());
};

export const uploadMediaFile = async (file, {
  title, uploadedAt, tags, uploadedBy, sharedWith = ['dad', 'mom'], uploadBatchId, contentHash,
}, { signal, onProgress = () => {} } = {}) => {
  onProgress({ phase: 'connecting', loaded: 0, total: file.size });
  const session = await uploadRequest(FUNCTIONS_URL.initMediaUpload, {
    signal,
    body: { userId: uploadedBy, contentHash, originalName: file.name, mimeType: file.type,
      fileSize: file.size, metadata: { title: title || file.name, uploadedAt, tags: tags || [], sharedWith, uploadBatchId } },
  });
  const uploaded = new Set(session.uploadedChunks || []);
  let loaded = [...uploaded].reduce((sum, index) => sum + Math.min(session.chunkSize, file.size - index * session.chunkSize), 0);
  onProgress({ phase: 'uploading', loaded, total: file.size });
  // One chunk at a time bounds memory and leaves the connection available for the app.
  for (let index = 0; index < session.totalChunks; index += 1) {
    if (uploaded.has(index)) continue;
    signal?.throwIfAborted();
    const chunk = file.slice(index * session.chunkSize, Math.min(file.size, (index + 1) * session.chunkSize));
    await retryUploadChunk(() => uploadRequest(`${FUNCTIONS_URL.uploadMedia}/${encodeURIComponent(session.sessionId)}/chunks/${index}`, {
      method: 'PUT', body: chunk, signal,
      onProgress: (bytes) => onProgress({ phase: 'uploading', loaded: loaded + Math.min(bytes, chunk.size), total: file.size }),
    }), signal, () => onProgress({ phase: 'retrying', loaded, total: file.size }));
    loaded += chunk.size;
    onProgress({ phase: 'uploading', loaded, total: file.size });
  }
  signal?.throwIfAborted();
  onProgress({ phase: 'processing', loaded: file.size, total: file.size });
  const media = await uploadRequest(`${FUNCTIONS_URL.uploadMedia}/${encodeURIComponent(session.sessionId)}/complete`, {
    signal, timeout: 120000,
  });
  return resolveMediaUrls(media);
};

export const getMediaDetails = async (id, userId, { force = false } = {}) => {
  const cacheKey = `${id}:${userId || ''}`;
  const cached = detailsCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.time < DETAILS_CACHE_MS) return cached.data;
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const response = await fetch(`${FUNCTIONS_URL.getMediaDetails}/${encodeURIComponent(id)}${query}`);
  if (!response.ok) throw new Error('미디어 상세 정보를 가져오지 못했습니다');
  const data = await response.json();
  detailsCache.set(cacheKey, { data, time: Date.now() });
  return data;
};

export const getFavoriteMedia = async (userId = getViewerId()) => {
  if (!userId) throw new Error('로그인 정보가 필요합니다');
  const response = await fetch(`${FUNCTIONS_URL.getFavoriteMedia}?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || '즐겨찾기 목록을 가져오지 못했습니다');
  }
  return (await response.json()).map(resolveMediaUrls);
};

export const getLikedMedia = async (userId = getViewerId()) => {
  if (!userId) throw new Error('로그인 정보가 필요합니다');
  const response = await fetch(`${FUNCTIONS_URL.getLikedMedia}?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || '좋아요 목록을 가져오지 못했습니다');
  }
  return (await response.json()).map(resolveMediaUrls);
};

const getSavedMediaPage = async (url, userId, limit, offset) => {
  const params = new URLSearchParams({ userId, limit: String(limit), offset: String(offset) });
  const response = await fetch(`${url}?${params}`);
  if (!response.ok) throw new Error('저장한 미디어 목록을 가져오지 못했습니다');
  const page = await response.json();
  return { items: (page.items || []).map(resolveMediaUrls), hasMore: Boolean(page.hasMore) };
};

export const getFavoriteMediaPage = (userId = getViewerId(), limit = 30, offset = 0) => (
  getSavedMediaPage(FUNCTIONS_URL.getFavoriteMedia, userId, limit, offset)
);

export const getLikedMediaPage = (userId = getViewerId(), limit = 30, offset = 0) => (
  getSavedMediaPage(FUNCTIONS_URL.getLikedMedia, userId, limit, offset)
);

export const toggleFavorite = async (userId, videoId) => {
  const response = await fetch(FUNCTIONS_URL.toggleFavorite, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, videoId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '즐겨찾기 처리에 실패했습니다');
  detailsCache.delete(`${videoId}:${userId}`);
  return data;
};

// 비디오 수정
export const updateVideo = async (id, videoData, requesterId = getViewerId()) => {
  const response = await fetch(`${FUNCTIONS_URL.updateVideo}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...videoData, requesterId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '비디오 수정에 실패했습니다');
  }

  const saved = await response.json();
  if (videoData.rotation !== undefined && saved.rotation !== videoData.rotation) {
    throw new Error('방향 보정이 저장되지 않았습니다. 잠시 후 다시 시도해 주세요.');
  }
  return resolveMediaUrls(saved);
};

// 비디오 삭제
export const deleteVideo = async (id, requesterId = getViewerId()) => {
  const response = await fetch(`${FUNCTIONS_URL.deleteVideo}/${id}?requesterId=${encodeURIComponent(requesterId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '비디오 삭제에 실패했습니다');
  }

  return response.json();
};

export const deleteMediaByDate = async (date) => {
  const token = JSON.parse(localStorage.getItem('hotube_user') || 'null')?.accessToken;
  const response = await fetch(`${FUNCTIONS_URL.deleteMediaByDate}/${encodeURIComponent(date)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '날짜별 미디어 삭제에 실패했습니다');
  return data;
};
