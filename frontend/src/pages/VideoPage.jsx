import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAllVideos } from '../services/videoApi';
import { extractVideoId } from '../services/youtubeService';

const VideoPage = () => {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const youtubeVideoId = extractVideoId(video.youtubeUrl);

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
          <label className="hidden md:flex relative w-full max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              search
            </span>
            <input
              className="form-input flex w-full rounded-full border border-zinc-300 bg-zinc-100 focus:border-primary focus:ring-primary h-10 placeholder:text-zinc-500 pl-10 pr-4 text-base font-normal text-zinc-900"
              placeholder="Search memories"
            />
          </label>
          <button className="flex items-center justify-center rounded-full h-10 w-10 bg-zinc-200 text-zinc-800">
            <span className="material-symbols-outlined">person</span>
          </button>
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
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
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
              <h3 className="text-lg font-bold text-zinc-900 px-4 lg:px-0">
                Up Next
              </h3>

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
