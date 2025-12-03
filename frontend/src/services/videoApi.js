const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// 모든 비디오 조회
export const getAllVideos = async () => {
  const response = await fetch(`${API_BASE_URL}/videos`);

  if (!response.ok) {
    throw new Error('비디오 목록을 가져오는데 실패했습니다');
  }

  return response.json();
};

// 단일 비디오 조회
export const getVideoById = async (id) => {
  const response = await fetch(`${API_BASE_URL}/videos/${id}`);

  if (!response.ok) {
    throw new Error('비디오를 찾을 수 없습니다');
  }

  return response.json();
};

// 비디오 등록
export const addVideo = async (videoData) => {
  const response = await fetch(`${API_BASE_URL}/videos`, {
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

  return response.json();
};

// 비디오 수정
export const updateVideo = async (id, videoData) => {
  const response = await fetch(`${API_BASE_URL}/videos/${id}`, {
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

  return response.json();
};

// 비디오 삭제
export const deleteVideo = async (id) => {
  const response = await fetch(`${API_BASE_URL}/videos/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '비디오 삭제에 실패했습니다');
  }

  return response.json();
};
