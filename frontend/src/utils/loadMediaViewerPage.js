let pending;

export const loadMediaViewerPage = () => {
  pending ??= import('../pages/MediaViewerPage').catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
};
