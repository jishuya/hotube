import VideoDurationBadge from './VideoDurationBadge';
import { isNewMedia } from '../../utils/mediaNotifications';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';

const VideoCard = ({ video, isShort = false }) => {
  const { user, isLiked } = useAuth();
  const isNew = isNewMedia(video, user);
  const liked = isLiked(video.id);

  return (
    <Link to={`/video/${video.id}`} className="flex flex-col gap-3 group">
      <div className={`w-full ${isShort ? 'aspect-[9/16]' : 'aspect-video'} rounded-lg overflow-hidden relative shadow-sm hover:shadow-lg transition-shadow`}>
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
        {/* 재생시간 */}
        <VideoDurationBadge media={video} />
        {/* NEW 배지 - 안본 영상 */}
        {isNew && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
            <Icon icon="mdi:new-box" className="text-sm" />
            NEW
          </span>
        )}
        {/* 좋아요 표시 */}
        {liked && (
          <span className="absolute top-0 right-0 flex size-11 items-center justify-center text-red-500">
            <Icon icon="mdi:heart" className="translate-x-1.5 -translate-y-1.5 text-lg" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold leading-normal group-hover:text-primary transition-colors text-[#181411] dark:text-gray-100 truncate">
          {video.title}
        </p>
        <p className="text-[#8a7560] dark:text-gray-400 text-sm sm:text-base font-normal leading-normal truncate">
          {video.uploadedAt && `Uploaded ${new Date(video.uploadedAt).toLocaleDateString()}`}
        </p>
        {video.tags && video.tags.length > 0 && (
          <p className="text-primary text-sm sm:text-base font-medium leading-normal truncate">
            {video.tags.map(tag => `#${tag}`).join(' ')}
          </p>
        )}
      </div>
    </Link>
  );
};

export default VideoCard;
