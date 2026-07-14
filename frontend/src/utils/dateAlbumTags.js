const STORAGE_KEY = 'hotube_date_album_tags';

export const getDateAlbumTags = () => {
  try {
    const savedTags = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return savedTags && typeof savedTags === 'object' && !Array.isArray(savedTags)
      ? savedTags
      : {};
  } catch {
    return {};
  }
};

export const saveDateAlbumTags = (date, tags) => {
  const allTags = getDateAlbumTags();
  if (tags.length > 0) allTags[date] = tags;
  else delete allTags[date];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allTags));
  return allTags;
};

