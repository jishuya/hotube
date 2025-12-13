import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getAllVideos } from '../services/videoApi';
import { extractVideoId } from '../services/youtubeService';
import { toggleLike, markVideoWatched } from '../services/authApi';
import { useAuth } from '../contexts/AuthContext';
import CommentSection from '../components/video/CommentSection';

const VideoPage = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { user, isLiked, toggleLikeLocal, markWatchedLocal } = useAuth();
  const [video, setVideo] = useState(null);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [likeLoading, setLikeLoading] = useState(false);

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

  // 시청 기록 추가
  useEffect(() => {
    if (video && user) {
      markVideoWatched(user.id, videoId).then(() => {
        markWatchedLocal(videoId);
      }).catch(err => console.error('시청 기록 추가 실패:', err));
    }
  }, [video, user, videoId, markWatchedLocal]);

  const loadVideoData = async () => {
    try {
      setLoading(true);
      const allVideos = await getAllVideos();

      // 현재 비디오 찾기
      const currentVideo = allVideos.find(v => v.id === videoId);
      setVideo(currentVideo);

      // 추천 영상 (같은 연도, 같은 타입)
      const sameYearAndType = allVideos
        .filter(v => v.year === currentVideo?.year && v.type === currentVideo?.type);

      const currentIndex = sameYearAndType.findIndex(v => v.id === videoId);
      const afterCurrent = sameYearAndType.slice(currentIndex + 1);
      const beforeCurrent = sameYearAndType.slice(0, currentIndex);
      const recommended = [...afterCurrent, ...beforeCurrent];

      setRecommendedVideos(recommended);
    } catch (error) {
      console.error('Error loading video:', error);
    } finally {
      setLoading(false);
    }
  };

  // 좋아요 토글
  const handleToggleLike = async () => {
    if (!user || likeLoading) return;

    try {
      setLikeLoading(true);
      await toggleLike(user.id, videoId);
      toggleLikeLocal(videoId);
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
    } finally {
      setLikeLoading(false);
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

  // 화면 크기 감지
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const playerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // YouTube Player 초기화
  useEffect(() => {
    if (!youtubeVideoId || loading || !video) return;

    const playerId = isMobile ? 'youtube-player-mobile' : 'youtube-player-desktop';

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      const playerElement = document.getElementById(playerId);
      if (!playerElement) return;

      playerRef.current = new window.YT.Player(playerId, {
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event) => {
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
  }, [youtubeVideoId, loading, video, playNextVideo, isMobile]);

  // 좋아요 버튼 컴포넌트
  const LikeButton = ({ className = '' }) => (
    <button
      onClick={handleToggleLike}
      disabled={likeLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
        isLiked(videoId)
          ? 'bg-red-500 text-white'
          : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'
      } ${likeLoading ? 'opacity-50' : ''} ${className}`}
    >
      <Icon
        icon={isLiked(videoId) ? 'mdi:heart' : 'mdi:heart-outline'}
        className="text-xl"
      />
      <span className="font-medium">
        {isLiked(videoId) ? '좋아요 취소' : '좋아요'}
      </span>
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading video...</p>
      </div>
    );
  }

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
      {/* 헤더 */}
      <header className="flex sticky top-0 z-10 h-14 lg:h-16 w-full items-center justify-between border-b border-zinc-200 bg-background-light/80 px-4 md:px-8 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="HoTube" className="w-8 h-8" />
            <h1 className="text-xl font-bold text-[#181411] dark:text-gray-100">HoTube</h1>
          </Link>
        </div>
        <div className="flex flex-1 justify-end items-center gap-4">
          <Link
            to="/"
            className="flex items-center justify-center rounded-full size-10 bg-primary/10 dark:bg-primary/20 text-[#181411] dark:text-gray-200 hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
          >
            <Icon icon="lucide:home" className="text-xl" />
          </Link>
        </div>
      </header>

      {/* 모바일 레이아웃 */}
      <div className="lg:hidden flex flex-col">
        {video.type === 'shorts' ? (
          <>
            {/* 플레이어 영역 */}
            <div className="bg-primary/5 py-3 px-3">
              <div className="w-full max-w-[280px] mx-auto aspect-[9/16] bg-zinc-900 overflow-hidden">
                <div id="youtube-player-mobile" className="w-full h-full"></div>
              </div>
            </div>

            {/* 영상 정보 영역 */}
            <div className="bg-primary/15 px-3 py-3 border-b border-primary/20">
              <div className="flex items-start gap-2">
                <Link to="/" className="shrink-0 mt-0.5">
                  <Icon icon="mdi:arrow-left" className="text-xl text-zinc-500" />
                </Link>
                <h1 className="text-zinc-900 text-base font-semibold leading-snug line-clamp-2 flex-1">
                  {video.title}
                </h1>
              </div>

              <div className="flex items-center justify-between mt-2 ml-7">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {video.uploadedAt && new Date(video.uploadedAt).toLocaleDateString()}
                  </span>
                  {video.tags && video.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {video.tags.slice(0, 2).map((tag, index) => (
                        <span key={index} className="text-xs text-primary">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <LikeButton className="text-sm py-1.5 px-3" />
              </div>
            </div>

            {/* 댓글 섹션 */}
            <div className="px-3 py-4">
              <CommentSection videoId={videoId} />
            </div>

            {/* 관련 영상 영역 */}
            {recommendedVideos.length > 0 && (
              <div className="px-3 py-4 border-t border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-700">자동 재생</span>
                  <button
                    onClick={() => setAutoPlay(!autoPlay)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      autoPlay ? 'bg-primary' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        autoPlay ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {recommendedVideos.map((recVideo) => (
                    <Link key={recVideo.id} to={`/video/${recVideo.id}`} className="group">
                      <div className="aspect-[9/16] rounded-lg overflow-hidden">
                        <img
                          className="w-full h-full object-cover group-active:scale-95 transition-transform"
                          src={recVideo.thumbnailUrl}
                          alt={recVideo.title}
                        />
                      </div>
                      <p className="text-xs font-medium text-zinc-900 line-clamp-2 mt-1.5 leading-tight">
                        {recVideo.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 플레이어 영역 */}
            <div className="bg-primary/5 p-3">
              <div className="w-full aspect-video bg-zinc-900 overflow-hidden">
                <div id="youtube-player-mobile" className="w-full h-full"></div>
              </div>
            </div>

            {/* 영상 정보 영역 */}
            <div className="bg-primary/15 px-3 py-3 border-b border-primary/20">
              <div className="flex items-start gap-2">
                <Link to="/" className="shrink-0 mt-0.5">
                  <Icon icon="mdi:arrow-left" className="text-xl text-zinc-500" />
                </Link>
                <h1 className="text-zinc-900 text-base font-semibold leading-snug line-clamp-2 flex-1">
                  {video.title}
                </h1>
              </div>

              <div className="flex items-center justify-between mt-2 ml-7">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {video.uploadedAt && new Date(video.uploadedAt).toLocaleDateString()}
                  </span>
                  {video.tags && video.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {video.tags.slice(0, 2).map((tag, index) => (
                        <span key={index} className="text-xs text-primary">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <LikeButton className="text-sm py-1.5 px-3" />
              </div>
            </div>

            {/* 댓글 섹션 */}
            <div className="px-3 py-4">
              <CommentSection videoId={videoId} />
            </div>

            {/* 관련 영상 영역 */}
            {recommendedVideos.length > 0 && (
              <div className="px-3 py-4 border-t border-zinc-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-700">자동 재생</span>
                  <button
                    onClick={() => setAutoPlay(!autoPlay)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      autoPlay ? 'bg-primary' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        autoPlay ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {recommendedVideos.map((recVideo) => (
                    <Link key={recVideo.id} to={`/video/${recVideo.id}`} className="group">
                      <div className="aspect-video rounded-lg overflow-hidden">
                        <img
                          className="w-full h-full object-cover group-active:scale-95 transition-transform"
                          src={recVideo.thumbnailUrl}
                          alt={recVideo.title}
                        />
                      </div>
                      <p className="text-xs font-medium text-zinc-900 line-clamp-2 mt-1.5 leading-tight">
                        {recVideo.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 데스크탑 레이아웃 */}
      <div className="hidden lg:block w-full max-w-screen-2xl mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {/* Main Video Section */}
          <div className="lg:col-span-2 xl:col-span-3">
            {/* YouTube Video Player */}
            <div className={`relative flex items-center justify-center bg-zinc-900 rounded-xl overflow-hidden shadow-lg ${
              video.type === 'shorts' ? 'aspect-[9/16] max-w-[340px] mx-auto' : 'aspect-video'
            }`}>
              <div id="youtube-player-desktop" className="w-full h-full"></div>
            </div>

            {/* Video Info */}
            <div className="flex items-start justify-between gap-4 pt-6 pb-2">
              <h1 className="text-zinc-900 tracking-tight text-2xl md:text-3xl font-bold leading-tight flex-1">
                {video.title}
              </h1>
              <LikeButton />
            </div>
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

            {/* 댓글 섹션 */}
            <div className="mt-6">
              <CommentSection videoId={videoId} />
            </div>
          </div>

          {/* Recommended Videos Sidebar */}
          <aside className="lg:col-span-1 xl:col-span-1">
            <div className="lg:sticky lg:top-24 flex flex-col gap-4 max-h-[calc(100vh-8rem)]">
              <div className="flex items-center justify-between px-4 lg:px-0">
                <h3 className="text-lg font-bold text-zinc-900">Up Next</h3>
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
                  <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2 scrollbar-thin">
                    {recommendedVideos.map((recVideo) => (
                      <Link key={recVideo.id} to={`/video/${recVideo.id}`} className="group cursor-pointer">
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
                  <div className="flex flex-col gap-3 overflow-y-auto pr-2">
                    {recommendedVideos.map((recVideo) => (
                      <Link key={recVideo.id} to={`/video/${recVideo.id}`} className="flex gap-3 group cursor-pointer">
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
