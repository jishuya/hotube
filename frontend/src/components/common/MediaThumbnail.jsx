import OrientedImage from './OrientedImage';
import { getMediaThumbnail } from '../../utils/youtubeThumbnail';

export default function MediaThumbnail({ media, alt = media.title || '', naturalAspect = false, className = '' }) {
  const thumbnail = getMediaThumbnail(media);
  const isYoutube = media.source === 'youtube' || media.mediaType === 'youtube';
  const videoFallback = !thumbnail && !isYoutube && (media.type === 'video' || media.mediaType === 'video');
  return (
    <div className={`h-full w-full ${className}`}>
      <OrientedImage
        src={thumbnail || (!isYoutube ? media.src || media.fileUrl : undefined)}
        alt={alt}
        rotation={media.rotation || 0}
        fit="cover"
        naturalAspect={naturalAspect}
        as={videoFallback ? 'video' : 'img'}
        onError={isYoutube ? (event) => {
          const fallback = getMediaThumbnail({ ...media, thumbnail: null, thumbnailUrl: null });
          if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
        } : undefined}
        onLoad={videoFallback ? (event) => {
          const video = event.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.min(1, video.duration / 2);
        } : undefined}
        {...(videoFallback ? { muted: true, playsInline: true, preload: 'metadata' } : { loading: 'lazy' })}
      />
    </div>
  );
}
