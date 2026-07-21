const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const FUNCTIONS_URL = {
  getVideos: `${API_BASE_URL}/getVideos`,
  getVideo: `${API_BASE_URL}/getVideo`,
  createVideo: `${API_BASE_URL}/createVideo`,
  updateVideo: `${API_BASE_URL}/updateVideo`,
  deleteVideo: `${API_BASE_URL}/deleteVideo`,
  uploadMedia: `${API_BASE_URL}/uploadMedia`,
};

const resolveApiUrl = (value) => {
  if (!value || /^(https?:|data:|blob:)/.test(value)) return value;
  return `${API_BASE_URL}${value}`;
};

const resolveMediaUrls = (media) => ({
  ...media,
  fileUrl: resolveApiUrl(media.fileUrl),
  thumbnailUrl: resolveApiUrl(media.thumbnailUrl),
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
export const getAllVideos = async (contentType = null) => {
  const query = contentType ? `?contentType=${encodeURIComponent(contentType)}` : '';
  const response = await fetch(`${FUNCTIONS_URL.getVideos}${query}`);

  if (!response.ok) {
    throw new Error('비디오 목록을 가져오는데 실패했습니다');
  }

  return (await response.json()).map(resolveMediaUrls);
};

// 단일 비디오 조회
export const getVideoById = async (id) => {
  const response = await fetch(`${FUNCTIONS_URL.getVideo}/${id}`);

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

export const uploadMediaFile = async (file, { title, uploadedAt, tags }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title || file.name);
  formData.append('uploadedAt', uploadedAt);
  formData.append('tags', JSON.stringify(tags || []));

  const response = await fetch(FUNCTIONS_URL.uploadMedia, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || '파일 업로드에 실패했습니다');
  }
  return resolveMediaUrls(await response.json());
};

// 비디오 수정
export const updateVideo = async (id, videoData) => {
  const response = await fetch(`${FUNCTIONS_URL.updateVideo}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(videoData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '비디오 수정에 실패했습니다');
  }

  return resolveMediaUrls(await response.json());
};

// 비디오 삭제
export const deleteVideo = async (id) => {
  const response = await fetch(`${FUNCTIONS_URL.deleteVideo}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '비디오 삭제에 실패했습니다');
  }

  return response.json();
};
