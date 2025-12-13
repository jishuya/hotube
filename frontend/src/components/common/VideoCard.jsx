import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';

// 초를 MM:SS 또는 HH:MM:SS 형식으로 변환
const formatDuration = (seconds) => {
  if (!seconds) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const VideoCard = ({ video, isShort = false }) => {
  const { isWatched, isLiked } = useAuth();
  const watched = isWatched(video.id);
  const liked = isLiked(video.id);

  return (
    <Link to={`/video/${video.id}`} className="flex flex-col gap-3 group">
      <div className={`w-full ${isShort ? 'aspect-[9/16]' : 'aspect-video'} rounded-lg overflow-hidden relative shadow-sm hover:shadow-lg transition-shadow`}>
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        {/* 재생시간 */}
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
          {formatDuration(video.durationSeconds)}
        </span>
        {/* NEW 배지 - 안본 영상 */}
        {!watched && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
            <Icon icon="mdi:new-box" className="text-sm" />
            NEW
          </span>
        )}
        {/* 좋아요 표시 */}
        {liked && (
          <span className="absolute top-2 right-2 bg-white/90 text-red-500 text-xs font-bold p-1.5 rounded-full shadow-md">
            <Icon icon="mdi:heart" className="text-lg" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className={`text-base font-semibold leading-normal group-hover:text-primary transition-colors ${
          watched ? 'text-zinc-400 dark:text-zinc-500' : 'text-[#181411] dark:text-gray-100'
        }`}>
          {video.title}
        </p>
        <p className="text-[#8a7560] dark:text-gray-400 text-base font-normal leading-normal">
          {video.uploadedAt && `Uploaded ${new Date(video.uploadedAt).toLocaleDateString()}`}
        </p>
        {video.tags && video.tags.length > 0 && (
          <p className="text-primary text-base font-medium leading-normal">
            {video.tags.map(tag => `#${tag}`).join(' ')}
          </p>
        )}
      </div>
    </Link>
  );
};

export default VideoCard;
