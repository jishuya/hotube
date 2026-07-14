const STORAGE_KEY = 'hotube_viewed_media_ids';

export const getViewedMediaIds = () => {
  try {
    const savedIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(savedIds) ? savedIds : [];
  } catch {
    return [];
  }
};

export const markMediaAsViewed = (mediaId) => {
  if (!mediaId) return;

  const viewedIds = getViewedMediaIds();
  if (!viewedIds.includes(mediaId)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...viewedIds, mediaId]));
  }
};

