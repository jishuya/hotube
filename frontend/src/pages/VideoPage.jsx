import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getAllVideos } from '../services/videoApi';
import { extractVideoId } from '../services/youtubeService';

const VideoPage = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef(null);
  const [autoPlay, setAutoPlay] = useState(true);

  // YouTube IFrame API 로드
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  useEffect(() => {
    loadVideoData();
  }, [videoId]);

  const loadVideoData = async () => {
    try {
      setLoading(true);
      const allVideos = await getAllVideos();

      // 현재 비디오 찾기
      const currentVideo = allVideos.find(v => v.id === videoId);
      setVideo(currentVideo);

      // 추천 영상 (같은 연도, 같은 타입, 현재 영상 제외)
      const recommended = allVideos
        .filter(v => v.id !== videoId && v.year === currentVideo?.year && v.type === currentVideo?.type);
      setRecommendedVideos(recommended);
    } catch (error) {
      console.error('Error loading video:', error);
    } finally {
      setLoading(false);
    }
  };

  // 다음 영상으로 자동 재생
  const playNextVideo = useCallback(() => {
    if (autoPlay && recommendedVideos.length > 0) {
      navigate(`/video/${recommendedVideos[0].id}`);
    }
  }, [autoPlay, recommendedVideos, navigate]);

  // YouTube Video ID 추출
  const youtubeVideoId = video ? extractVideoId(video.youtubeUrl) : null;

  // YouTube Player 초기화
  useEffect(() => {
    if (!youtubeVideoId || loading || !video) return;

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event) => {
            // 영상이 끝났을 때 (state === 0)
            if (event.data === window.YT.PlayerState.ENDED) {
              playNextVideo();
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [youtubeVideoId, loading, video, playNextVideo]);

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading video...</p>
      </div>
    );
  }

  // 비디오 없음
  if (!video) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-xl">Video not found</p>
        <Link to="/" className="text-primary hover:underline">
          Go back to homepage
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light">
      <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-background-light/80 px-4 md:px-8 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="HoTube" className="w-8 h-8" />
            <h1 className="text-xl font-bold text-[#181411] dark:text-gray-100">HoTube</h1>
          </Link>
        </div>
        <div className="flex flex-1 justify-end items-center gap-4">
          <Link
            to="/admin"
            className="flex items-center justify-center rounded-full size-10 bg-primary/10 dark:bg-primary/20 text-[#181411] dark:text-gray-200 hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
          >
            <Icon icon="lucide:settings" className="text-xl" />
          </Link>
        </div>
      </header>

      <div className="w-full max-w-screen-2xl mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {/* Main Video Section */}
          <div className="lg:col-span-2 xl:col-span-3">
            {/* YouTube Video Player */}
            <div className={`relative flex items-center justify-center bg-zinc-900 rounded-xl overflow-hidden shadow-lg ${
              video.type === 'shorts' ? 'aspect-[9/16] max-w-sm mx-auto' : 'aspect-video'
            }`}>
              <div id="youtube-player" className="w-full h-full"></div>
            </div>

            {/* Video Info */}
            <h1 className="text-zinc-900 tracking-tight text-2xl md:text-3xl font-bold leading-tight pt-6 pb-2">
              {video.title}
            </h1>
            <p className="text-zinc-500 text-sm font-normal leading-normal pb-4">
              {video.uploadedAt && `Filmed in ${new Date(video.uploadedAt).toLocaleDateString()}`}
            </p>

            {/* Description */}
            <div className="border-y border-zinc-200 py-4">
              <p className="text-zinc-800 text-base font-normal leading-relaxed">
                {video.description || 'No description available.'}
              </p>
              {video.tags && video.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4">
                  {video.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="cursor-pointer rounded-lg bg-primary/20 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/30"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recommended Videos Sidebar */}
          <aside className="lg:col-span-1 xl:col-span-1">
            <div className="lg:sticky lg:top-24 flex flex-col gap-4 max-h-[calc(100vh-8rem)]">
              <div className="flex items-center justify-between px-4 lg:px-0">
                <h3 className="text-lg font-bold text-zinc-900">
                  Up Next
                </h3>
                {/* 자동 재생 토글 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600">자동 재생</span>
                  <button
                    onClick={() => setAutoPlay(!autoPlay)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoPlay ? 'bg-primary' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoPlay ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {recommendedVideos.length > 0 ? (
                video?.type === 'shorts' ? (
                  // Shorts 그리드
                  <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2 scrollbar-thin">
                    {recommendedVideos.map((recVideo) => (
                      <Link
                        key={recVideo.id}
                        to={`/video/${recVideo.id}`}
                        className="group cursor-pointer"
                      >
                        <div className="aspect-[9/16] relative rounded-lg overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                          <img
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            src={recVideo.thumbnailUrl}
                            alt={recVideo.title}
                          />
                        </div>
                        <h4 className="font-medium text-zinc-800 group-hover:text-primary transition-colors line-clamp-2 leading-tight text-sm mt-2">
                          {recVideo.title}
                        </h4>
                      </Link>
                    ))}
                  </div>
                ) : (
                  // Videos 리스트
                  <div className="flex flex-col gap-3 overflow-y-auto pr-2">
                    {recommendedVideos.map((recVideo) => (
                      <Link
                        key={recVideo.id}
                        to={`/video/${recVideo.id}`}
                        className="flex gap-3 group cursor-pointer"
                      >
                        <div className="w-40 aspect-video relative rounded-lg overflow-hidden shrink-0 shadow-md group-hover:shadow-lg transition-shadow">
                          <img
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            src={recVideo.thumbnailUrl}
                            alt={recVideo.title}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-zinc-800 group-hover:text-primary transition-colors line-clamp-2 leading-tight text-sm">
                            {recVideo.title}
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1">
                            {recVideo.uploadedAt && new Date(recVideo.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-zinc-500 text-sm px-4 lg:px-0">
                  이 연도의 다른 영상이 없습니다.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default VideoPage;
