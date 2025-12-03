import { Link } from 'react-router-dom';

const VideoCard = ({ video, isShort = false }) => {
  return (
    <Link to={`/video/${video.id}`} className="flex flex-col gap-3 group">
      <div className={`w-full bg-center bg-no-repeat ${isShort ? 'aspect-[9/16]' : 'aspect-video'} bg-cover rounded-lg overflow-hidden relative shadow-sm hover:shadow-lg transition-shadow`}>
        <div
          className="w-full h-full"
          style={{ backgroundImage: `url('${video.thumbnailUrl}')` }}
        ></div>
        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
          {video.duration || '0:00'}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[#181411] dark:text-gray-100 text-base font-semibold leading-normal group-hover:text-primary transition-colors">
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
