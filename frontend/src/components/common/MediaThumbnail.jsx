import OrientedImage from './OrientedImage';

export default function MediaThumbnail({ media, alt = media.title || '', naturalAspect = false, className = '' }) {
  const thumbnail = media.thumbnail || media.thumbnailUrl;
  const videoFallback = !thumbnail && (media.type === 'video' || media.mediaType === 'video');
  return (
    <div className={`h-full w-full ${className}`}>
      <OrientedImage
        src={thumbnail || media.src || media.fileUrl}
        alt={alt}
        rotation={media.rotation || 0}
        fit="cover"
        naturalAspect={naturalAspect}
        as={videoFallback ? 'video' : 'img'}
        onLoad={videoFallback ? (event) => {
          const video = event.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.min(1, video.duration / 2);
        } : undefined}
        {...(videoFallback ? { muted: true, playsInline: true, preload: 'metadata' } : { loading: 'lazy' })}
      />
    </div>
  );
}
