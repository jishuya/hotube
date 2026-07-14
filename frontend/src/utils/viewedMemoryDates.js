const STORAGE_KEY = 'hotube_viewed_memory_dates';

export const getViewedMemoryDates = () => {
  try {
    const savedDates = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(savedDates) ? savedDates : [];
  } catch {
    return [];
  }
};

export const markMemoryDateAsViewed = (date) => {
  if (!date) return;

  const viewedDates = getViewedMemoryDates();
  if (!viewedDates.includes(date)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...viewedDates, date]));
  }
};

