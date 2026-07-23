const { randomUUID } = require('crypto');
const pgDb = require('../db');
const { HttpError } = require('../httpErrors');
const { userExists } = require('./userService');
const { getMediaAccess } = require('./mediaService');

const normalizeTitle = (value) => {
  const title = String(value || '').trim();
  if (!title) throw new HttpError(400, '앨범 제목을 입력해주세요');
  if (title.length > 80) throw new HttpError(400, '앨범 제목은 80자 이하여야 합니다');
  return title;
};

const normalizeDescription = (value) => {
  const description = String(value || '').trim();
  if (description.length > 500) throw new HttpError(400, '앨범 설명은 500자 이하여야 합니다');
  return description;
};

const versionedPath = (path, updatedAt) => {
  if (!path || !updatedAt) return path;
  const version = updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt;
  return `${path}?v=${encodeURIComponent(version)}`;
};

const getCoverUrl = (row) => {
  if (!row.cover_media_id) return null;
  if (row.cover_thumbnail_path) {
    return versionedPath(`/mediaThumbnail/${encodeURIComponent(row.cover_media_id)}`, row.cover_updated_at);
  }
  if (row.cover_thumbnail_url) return row.cover_thumbnail_url;
  if (row.cover_media_type === 'photo' && row.cover_file_path) {
    return versionedPath(`/mediaFile/${encodeURIComponent(row.cover_media_id)}`, row.cover_updated_at);
  }
  return null;
};

const mapAlbum = (row) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  description: row.description,
  mediaCount: Number(row.media_count || 0),
  coverMediaId: row.cover_media_id || null,
  coverThumbnailUrl: getCoverUrl(row),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const albumSelect = `
  SELECT a.id, a.user_id, a.title, a.description, a.created_at, a.updated_at,
    (SELECT COUNT(*)::int FROM user_album_media count_am WHERE count_am.album_id = a.id) AS media_count,
    cover.id AS cover_media_id,
    cover.media_type AS cover_media_type,
    cover.file_path AS cover_file_path,
    cover.thumbnail_path AS cover_thumbnail_path,
    cover.thumbnail_url AS cover_thumbnail_url,
    cover.updated_at AS cover_updated_at
  FROM user_albums a
  LEFT JOIN LATERAL (
    SELECT m.id, m.media_type, m.file_path, m.thumbnail_path, m.thumbnail_url, m.updated_at
    FROM user_album_media cover_am
    JOIN media m ON m.id = cover_am.media_id
    WHERE cover_am.album_id = a.id
    ORDER BY cover_am.position, cover_am.created_at
    LIMIT 1
  ) cover ON TRUE
`;

const listUserAlbums = async (userId) => {
  if (!userId) throw new HttpError(400, '사용자 정보가 필요합니다');
  if (!(await userExists(pgDb, userId))) throw new HttpError(404, '사용자를 찾을 수 없습니다');
  const result = await pgDb.query(`
    ${albumSelect}
    WHERE a.user_id = $1
    ORDER BY a.updated_at DESC, a.created_at DESC
  `, [userId]);
  return result.rows.map(mapAlbum);
};

const getUserAlbum = async (albumId, userId) => {
  if (!albumId || !userId) throw new HttpError(400, '앨범과 사용자 정보가 필요합니다');
  const result = await pgDb.query(`
    ${albumSelect}
    WHERE a.id = $1 AND a.user_id = $2
  `, [albumId, userId]);
  if (!result.rows.length) throw new HttpError(404, '앨범을 찾을 수 없습니다');
  return mapAlbum(result.rows[0]);
};

const createUserAlbum = async ({ userId, title, description }) => {
  if (!userId) throw new HttpError(400, '사용자 정보가 필요합니다');
  if (!(await userExists(pgDb, userId))) throw new HttpError(404, '사용자를 찾을 수 없습니다');
  const result = await pgDb.query(`
    INSERT INTO user_albums (id, user_id, title, description)
    VALUES ($1, $2, $3, $4)
    RETURNING *, 0::int AS media_count, NULL::text AS cover_media_id
  `, [randomUUID(), userId, normalizeTitle(title), normalizeDescription(description)]);
  return mapAlbum(result.rows[0]);
};

const updateUserAlbum = async (albumId, { userId, title, description }) => {
  if (!userId) throw new HttpError(400, '사용자 정보가 필요합니다');
  const updates = [];
  const values = [];
  if (title !== undefined) {
    values.push(normalizeTitle(title));
    updates.push(`title = $${values.length}`);
  }
  if (description !== undefined) {
    values.push(normalizeDescription(description));
    updates.push(`description = $${values.length}`);
  }
  if (!updates.length) throw new HttpError(400, '변경할 앨범 정보가 필요합니다');
  values.push(albumId, userId);
  const result = await pgDb.query(`
    UPDATE user_albums
    SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${values.length - 1} AND user_id = $${values.length}
    RETURNING id
  `, values);
  if (!result.rows.length) throw new HttpError(404, '앨범을 찾을 수 없습니다');
  return getUserAlbum(albumId, userId);
};

const deleteUserAlbum = async (albumId, userId) => {
  if (!albumId || !userId) throw new HttpError(400, '앨범과 사용자 정보가 필요합니다');
  const result = await pgDb.query(
    'DELETE FROM user_albums WHERE id = $1 AND user_id = $2 RETURNING id',
    [albumId, userId],
  );
  if (!result.rows.length) throw new HttpError(404, '앨범을 찾을 수 없습니다');
  return { id: result.rows[0].id };
};

const listUserAlbumMedia = async (albumId, userId) => {
  await getUserAlbum(albumId, userId);
  const result = await pgDb.query(`
    SELECT m.*,
      COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
    FROM user_album_media am
    JOIN media m ON m.id = am.media_id
    JOIN users u ON u.id = $2
    LEFT JOIN media_tags mt ON mt.media_id = m.id
    LEFT JOIN tags t ON t.id = mt.tag_id
    WHERE am.album_id = $1
      AND (
        u.role IN ('admin', 'sub-admin')
        OR u.category = ANY(m.shared_with)
        OR m.uploaded_by = u.id
      )
    GROUP BY m.id, am.position, am.created_at
    ORDER BY am.position, am.created_at
  `, [albumId, userId]);
  return result.rows;
};

const normalizeMediaIds = (value) => {
  const mediaIds = [...new Set((Array.isArray(value) ? value : [value]).map(String).filter(Boolean))];
  if (!mediaIds.length) throw new HttpError(400, '앨범에 담을 미디어가 필요합니다');
  if (mediaIds.length > 100) throw new HttpError(400, '한 번에 100개까지 담을 수 있습니다');
  return mediaIds;
};

const addMediaToUserAlbum = async (albumId, userId, value) => {
  if (!albumId || !userId) throw new HttpError(400, '앨범과 사용자 정보가 필요합니다');
  const mediaIds = normalizeMediaIds(value);
  let client;
  try {
    client = await pgDb.getClient();
    await client.query('BEGIN');
    const album = await client.query(
      'SELECT id FROM user_albums WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [albumId, userId],
    );
    if (!album.rows.length) throw new HttpError(404, '앨범을 찾을 수 없습니다');
    const positionResult = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM user_album_media WHERE album_id = $1',
      [albumId],
    );
    let position = Number(positionResult.rows[0].next_position);
    const addedMediaIds = [];
    for (const mediaId of mediaIds) {
      const access = await getMediaAccess(client, mediaId, userId);
      if (!access?.can_view) throw new HttpError(403, '앨범에 담을 수 없는 미디어가 포함되어 있습니다');
      const inserted = await client.query(`
        INSERT INTO user_album_media (album_id, media_id, position)
        VALUES ($1, $2, $3)
        ON CONFLICT (album_id, media_id) DO NOTHING
        RETURNING media_id
      `, [albumId, mediaId, position]);
      if (inserted.rows.length) {
        addedMediaIds.push(mediaId);
        position += 1;
      }
    }
    if (addedMediaIds.length) {
      await client.query('UPDATE user_albums SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [albumId]);
    }
    await client.query('COMMIT');
    return { albumId, addedMediaIds };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client?.release();
  }
};

const removeMediaFromUserAlbum = async (albumId, userId, value) => {
  if (!albumId || !userId) throw new HttpError(400, '앨범과 사용자 정보가 필요합니다');
  const mediaIds = normalizeMediaIds(value);
  const result = await pgDb.query(`
    WITH owned_album AS (
      SELECT id FROM user_albums WHERE id = $1 AND user_id = $2
    ), deleted AS (
      DELETE FROM user_album_media am
      USING owned_album a
      WHERE am.album_id = a.id AND am.media_id = ANY($3::text[])
      RETURNING am.media_id
    )
    UPDATE user_albums
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id IN (SELECT id FROM owned_album)
      AND EXISTS (SELECT 1 FROM deleted)
    RETURNING (SELECT array_agg(media_id) FROM deleted) AS removed_media_ids
  `, [albumId, userId, mediaIds]);
  if (!result.rows.length) {
    const album = await pgDb.query('SELECT 1 FROM user_albums WHERE id = $1 AND user_id = $2', [albumId, userId]);
    if (!album.rows.length) throw new HttpError(404, '앨범을 찾을 수 없습니다');
    return { albumId, removedMediaIds: [] };
  }
  return { albumId, removedMediaIds: result.rows[0].removed_media_ids || [] };
};

module.exports = {
  addMediaToUserAlbum,
  createUserAlbum,
  deleteUserAlbum,
  getUserAlbum,
  listUserAlbumMedia,
  listUserAlbums,
  removeMediaFromUserAlbum,
  updateUserAlbum,
};
