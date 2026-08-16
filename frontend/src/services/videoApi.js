const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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

export const checkMediaDuplicates = async (hashes) => {
  const response = await fetch(FUNCTIONS_URL.checkMediaDuplicates, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes }),
  });
  if (!response.ok) throw new Error('중복 파일을 확인하지 못했습니다');
  return (await response.json()).duplicateHashes || [];
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
});

export const toMemoryMedia = (media) => ({
  ...media,
  date: media.uploadedAt,
  type: media.mediaType === 'photo' ? 'photo' : 'video',
  videoType: media.type,
  source: media.mediaType === 'youtube' ? 'youtube' : 'file',
  src: media.mediaType === 'youtube' ? media.youtubeUrl : media.fileUrl,
  thumbnail: media.thumbnailUrl || (media.mediaType === 'photo' ? media.fileUrl : null),
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
export const addVideo = async (videoData) => {
  const response = await fetch(FUNCTIONS_URL.createVideo, {
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
}) => {
  const parseUploadError = async (response, fallback) => {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || fallback);
    error.code = body.code;
    throw error;
  };
  const initResponse = await fetch(FUNCTIONS_URL.initMediaUpload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: uploadedBy,
      contentHash,
      originalName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      metadata: { title: title || file.name, uploadedAt, tags: tags || [], sharedWith, uploadBatchId },
    }),
  });
  if (!initResponse.ok) await parseUploadError(initResponse, '업로드를 시작하지 못했습니다');
  const session = await initResponse.json();
  const uploaded = new Set(session.uploadedChunks || []);
  const missingChunks = Array.from({ length: session.totalChunks }, (_, index) => index)
    .filter((index) => !uploaded.has(index));
  let nextChunk = 0;
  const uploadChunk = async (index) => {
    const start = index * session.chunkSize;
    const body = file.slice(start, Math.min(file.size, start + session.chunkSize));
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${FUNCTIONS_URL.uploadMedia}/${encodeURIComponent(session.sessionId)}/chunks/${index}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body,
        });
        if (!response.ok) await parseUploadError(response, '파일 일부를 올리지 못했습니다');
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, attempt * 1000));
      }
    }
    throw lastError;
  };
  await Promise.all(Array.from({ length: Math.min(3, missingChunks.length) }, async () => {
    while (nextChunk < missingChunks.length) {
      const index = missingChunks[nextChunk];
      nextChunk += 1;
      await uploadChunk(index);
    }
  }));
  const completeResponse = await fetch(`${FUNCTIONS_URL.uploadMedia}/${encodeURIComponent(session.sessionId)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!completeResponse.ok) {
    await parseUploadError(completeResponse, '업로드를 완료하지 못했습니다');
  }
  return resolveMediaUrls(await completeResponse.json());
};

export const getMediaDetails = async (id, userId) => {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const response = await fetch(`${FUNCTIONS_URL.getMediaDetails}/${encodeURIComponent(id)}${query}`);
  if (!response.ok) throw new Error('미디어 상세 정보를 가져오지 못했습니다');
  return response.json();
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

export const toggleFavorite = async (userId, videoId) => {
  const response = await fetch(FUNCTIONS_URL.toggleFavorite, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, videoId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '즐겨찾기 처리에 실패했습니다');
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

  return resolveMediaUrls(await response.json());
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
