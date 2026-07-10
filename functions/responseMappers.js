const toIsoString = (value) => {
  if (!value) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const toDateString = (value) => {
  if (!value) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
};

const normalizeArray = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== undefined);
  }

  return [value];
};

const mapContentTypeToApiType = (contentType) => {
  if (contentType === "long") {
    return "video";
  }

  return contentType;
};

const mapMediaRowToMedia = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  contentType: row.content_type,
  mediaType: row.media_type,
  youtubeUrl: row.youtube_url,
  filePath: row.file_path,
  thumbnailUrl: row.thumbnail_url,
  thumbnailPath: row.thumbnail_path,
  year: row.year,
  uploadedAt: toDateString(row.uploaded_at),
  durationSeconds: row.duration_seconds,
  viewCount: row.view_count,
  likeCount: row.like_count,
  channelTitle: row.channel_title,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapMediaRowToVideo = (row) => ({
  ...mapMediaRowToMedia(row),
  type: mapContentTypeToApiType(row.content_type ?? row.type),
  tags: normalizeArray(row.tags),
});

const mapTagRowToTag = (row) => ({
  id: row.id,
  name: row.name,
});

const mapMediaTagRowToMediaTag = (row) => ({
  mediaId: row.media_id,
  tagId: row.tag_id,
});

const mapUserRowToUserRecord = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  title: row.title,
  category: row.category,
  role: row.role,
  password: row.password,
  createdAt: toIsoString(row.created_at),
});

const mapUserRowToUser = (row) => {
  const { password: _, ...user } = mapUserRowToUserRecord(row);

  return {
    ...user,
    likedVideos: normalizeArray(row.liked_videos),
    watchedVideos: normalizeArray(row.watched_videos),
  };
};

const mapCommentRowToCommentRecord = (row) => ({
  id: row.id,
  mediaId: row.media_id,
  userId: row.user_id,
  userName: row.user_name,
  userTitle: row.user_title,
  userCategory: row.user_category,
  content: row.content,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapCommentRowToComment = (row) => ({
  ...mapCommentRowToCommentRecord(row),
  videoId: row.media_id,
});

const mapLikedMediaRowToLikedMedia = (row) => ({
  userId: row.user_id,
  mediaId: row.media_id,
});

const mapWatchedMediaRowToWatchedMedia = (row) => ({
  userId: row.user_id,
  mediaId: row.media_id,
});

const mapUserRelationsToUserLists = (row) => ({
  userId: row.user_id,
  likedVideos: normalizeArray(row.liked_videos),
  watchedVideos: normalizeArray(row.watched_videos),
});

module.exports = {
  mapMediaRowToMedia,
  mapMediaRowToVideo,
  mapTagRowToTag,
  mapMediaTagRowToMediaTag,
  mapUserRowToUserRecord,
  mapUserRowToUser,
  mapCommentRowToCommentRecord,
  mapCommentRowToComment,
  mapLikedMediaRowToLikedMedia,
  mapWatchedMediaRowToWatchedMedia,
  mapUserRelationsToUserLists,
};
