// Firebase Functions URLs
const FUNCTIONS_URL = {
  getVideos: 'https://getvideos-2wvg2ln7bq-du.a.run.app',
  getVideo: 'https://getvideo-2wvg2ln7bq-du.a.run.app',
  createVideo: 'https://createvideo-2wvg2ln7bq-du.a.run.app',
  updateVideo: 'https://updatevideo-2wvg2ln7bq-du.a.run.app',
  deleteVideo: 'https://deletevideo-2wvg2ln7bq-du.a.run.app',
};

// 모든 비디오 조회
export const getAllVideos = async () => {
  const response = await fetch(FUNCTIONS_URL.getVideos);

  if (!response.ok) {
    throw new Error('비디오 목록을 가져오는데 실패했습니다');
  }

  return response.json();
};

// 단일 비디오 조회
export const getVideoById = async (id) => {
  const response = await fetch(`${FUNCTIONS_URL.getVideo}/${id}`);

  if (!response.ok) {
    throw new Error('비디오를 찾을 수 없습니다');
  }

  return response.json();
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

  return response.json();
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

  return response.json();
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
