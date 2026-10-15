export const isNewMedia = (media, user) => Boolean(
  user?.id
  && media.uploadedBy !== user.id
  && user.notifiedMediaIds?.includes(media.id)
  && !user.watchedVideos?.includes(media.id)
);
