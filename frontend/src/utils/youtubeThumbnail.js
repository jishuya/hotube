export const getYoutubeThumbnail = (videoId, thumbnails = {}) => {
  const available = thumbnails || {};
  return available.maxres?.url
    || available.standard?.url
    || available.high?.url
    || available.medium?.url
    || available.default?.url
    || (/^[a-zA-Z0-9_-]{11}$/.test(videoId || '')
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : null);
};

export const getMediaThumbnail = (media) => {
  if (media.thumbnail || media.thumbnailUrl) return media.thumbnail || media.thumbnailUrl;
  if (media.source !== 'youtube' && media.mediaType !== 'youtube') return null;
  const value = media.youtubeUrl || media.src || '';
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '');
    const id = host === 'youtu.be' ? url.pathname.split('/')[1]
      : ['youtube.com', 'm.youtube.com'].includes(host)
        ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1]
        : null;
    return getYoutubeThumbnail(id);
  } catch {
    return getYoutubeThumbnail(value);
  }
};
