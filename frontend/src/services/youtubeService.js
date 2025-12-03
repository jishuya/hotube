const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube URL에서 Video ID 추출
 * 지원 형식:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export const extractVideoId = (url) => {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // 직접 Video ID 입력
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

/**
 * ISO 8601 Duration을 초로 변환
 * 예: PT4M46S -> 286
 */
const parseDuration = (duration) => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
};

/**
 * YouTube API로 영상 정보 가져오기
 */
export const fetchVideoInfo = async (videoId) => {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API 키가 설정되지 않았습니다. .env 파일에 VITE_YOUTUBE_API_KEY를 추가해주세요.');
  }

  const url = `${YOUTUBE_API_BASE_URL}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('YouTube API 요청에 실패했습니다.');
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('영상을 찾을 수 없습니다. URL을 확인해주세요.');
  }

  const video = data.items[0];
  const snippet = video.snippet;
  const contentDetails = video.contentDetails;

  // 영상 길이 (초)
  const durationInSeconds = parseDuration(contentDetails.duration);

  // 60초 이하면 shorts로 판단
  const type = durationInSeconds <= 60 ? 'shorts' : 'video';

  // 업로드 연도 추출
  const publishedAt = new Date(snippet.publishedAt);
  const year = publishedAt.getFullYear();

  // 가장 고화질 썸네일 선택
  const thumbnails = snippet.thumbnails;
  const thumbnailUrl =
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url;

  return {
    videoId,
    title: snippet.title,
    description: snippet.description,
    thumbnailUrl,
    channelTitle: snippet.channelTitle,
    publishedAt: snippet.publishedAt,
    uploadedAt: publishedAt.toISOString().split('T')[0],
    year,
    type,
    durationInSeconds,
    tags: snippet.tags || [],
    viewCount: parseInt(video.statistics?.viewCount || 0),
    likeCount: parseInt(video.statistics?.likeCount || 0)
  };
};

/**
 * YouTube URL로 영상 정보 가져오기 (편의 함수)
 */
export const fetchVideoInfoByUrl = async (youtubeUrl) => {
  const videoId = extractVideoId(youtubeUrl);

  if (!videoId) {
    throw new Error('유효하지 않은 YouTube URL입니다.');
  }

  return await fetchVideoInfo(videoId);
};
