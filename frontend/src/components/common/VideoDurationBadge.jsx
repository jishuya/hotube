import { useEffect, useRef, useState } from 'react';

const durationCache = new Map();

export default function VideoDurationBadge({ media }) {
  const badgeRef = useRef(null);
  const src = media.source === 'youtube' || media.mediaType === 'youtube' ? null : media.src || media.fileUrl || media.preview;
  const [loaded, setLoaded] = useState(null);
  const saved = Number(media.durationSeconds);
  const seconds = saved > 0 ? saved : loaded?.src === src ? loaded.seconds : durationCache.get(src);

  useEffect(() => {
    if (saved > 0 || !src || durationCache.has(src)) return;
    let video;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          durationCache.set(src, video.duration);
          setLoaded({ src, seconds: video.duration });
        }
        video.removeAttribute('src');
        video.load();
      };
      video.src = src;
    }, { rootMargin: '100px' });
    observer.observe(badgeRef.current);
    return () => {
      observer.disconnect();
      if (video) {
        video.onloadedmetadata = null;
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [src, saved]);

  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const time = seconds > 0
    ? `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : minutes}:${String(total % 60).padStart(2, '0')}`
    : '…';

  return (
    <span ref={badgeRef} className="pointer-events-none absolute bottom-2 left-2 z-10 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold leading-tight text-white" aria-label={`재생 시간 ${time}`}>
      <span aria-hidden="true">▶</span> {time}
    </span>
  );
}
