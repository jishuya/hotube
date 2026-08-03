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
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
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

const versionedMediaPath = (path, updatedAt) => {
  if (!path || !updatedAt) return path;
  return `${path}?v=${encodeURIComponent(toIsoString(updatedAt))}`;
};

const mapMediaRowToVideo = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  youtubeUrl: row.youtube_url,
  mediaType: row.media_type,
  fileUrl: row.file_path
    ? versionedMediaPath(`/mediaFile/${encodeURIComponent(row.id)}`, row.updated_at)
    : null,
  thumbnailUrl: row.thumbnail_path
    ? versionedMediaPath(`/mediaThumbnail/${encodeURIComponent(row.id)}`, row.updated_at)
    : row.thumbnail_url,
  type: row.content_type ?? row.type,
  year: row.year,
  tags: normalizeArray(row.tags),
  uploadedAt: toDateString(row.uploaded_at),
  durationSeconds: row.duration_seconds,
  viewCount: row.view_count,
  likeCount: row.like_count,
  channelTitle: row.channel_title,
  uploadedBy: row.uploaded_by,
  sharedWith: normalizeArray(row.shared_with),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapUserRowToUser = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  title: row.title,
  category: row.category,
  role: row.role,
  avatar: row.avatar,
  createdAt: toIsoString(row.created_at),
  likedVideos: normalizeArray(row.liked_videos),
  watchedVideos: normalizeArray(row.watched_videos),
});

const mapCommentRowToComment = (row) => ({
  id: row.id,
  videoId: row.media_id,
  userId: row.user_id,
  userName: row.user_name,
  userTitle: row.user_title,
  userCategory: row.user_category,
  userAvatar: row.user_avatar || row.avatar || null,
  content: row.content,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

module.exports = {
  mapMediaRowToVideo,
  mapUserRowToUser,
  mapCommentRowToComment,
};
