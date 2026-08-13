const pgDb = require("../db");
const { HttpError } = require("../httpErrors");

const MEDIA_WITH_TAGS_SELECT = `
  SELECT
    m.*,
    COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
  FROM media m
  LEFT JOIN media_tags mt ON mt.media_id = m.id
  LEFT JOIN tags t ON t.id = mt.tag_id
`;

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags
    .map((tag) => String(tag).trim().replace(/^#/, '').normalize('NFC'))
    .filter(Boolean))];
};

const cleanupOrphanTags = async (client, tagIds) => {
  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length === 0) return;
  await client.query(`
    DELETE FROM tags t
    WHERE t.id = ANY($1::bigint[])
      AND NOT EXISTS (SELECT 1 FROM media_tags mt WHERE mt.tag_id = t.id)
  `, [uniqueTagIds]);
};

const toContentType = (type) => (type === "short" ? "short" : "long");

const fetchMediaById = async (client, id) => {
  const result = await client.query(`
    ${MEDIA_WITH_TAGS_SELECT}
    WHERE m.id = $1
    GROUP BY m.id
  `, [id]);

  return result.rows[0] || null;
};

const listMedia = async ({
  contentType = null,
  search = null,
  tag = null,
  uploadedAt = null,
  dateFrom = null,
  dateTo = null,
  source = null,
  mediaType = null,
  year = null,
  ids = null,
  viewerCategory = null,
  viewerRole = null,
  viewerId = null,
  limit = null,
  offset = 0,
} = {}) => {
  const conditions = [];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (contentType) conditions.push(`m.content_type = ${addParam(contentType)}`);
  if (uploadedAt) conditions.push(`m.uploaded_at = ${addParam(uploadedAt)}`);
  if (dateFrom) conditions.push(`m.uploaded_at >= ${addParam(dateFrom)}`);
  if (dateTo) conditions.push(`m.uploaded_at < ${addParam(dateTo)}`);
  if (source === 'youtube') conditions.push("m.media_type = 'youtube'");
  if (source === 'file') conditions.push("m.media_type IN ('photo', 'video')");
  if (mediaType === 'photo') conditions.push("m.media_type = 'photo'");
  if (mediaType === 'video') conditions.push("m.media_type IN ('video', 'youtube')");
  if (year) conditions.push(`m.year = ${addParam(year)}`);
  if (Array.isArray(ids) && ids.length > 0) conditions.push(`m.id = ANY(${addParam(ids)}::text[])`);
  if (viewerRole !== 'admin' && viewerRole !== 'sub-admin') {
    if (!viewerCategory) conditions.push('FALSE');
    else {
      const categoryParam = addParam(viewerCategory);
      const viewerParam = addParam(viewerId);
      conditions.push(`(${categoryParam} = ANY(m.shared_with) OR m.uploaded_by = ${viewerParam})`);
    }
  }
  if (search) {
    const searchParam = addParam(`%${search}%`);
    conditions.push(`(
      m.title ILIKE ${searchParam}
      OR COALESCE(m.description, '') ILIKE ${searchParam}
      OR EXISTS (
        SELECT 1
        FROM media_tags search_mt
        JOIN tags search_t ON search_t.id = search_mt.tag_id
        WHERE search_mt.media_id = m.id
          AND search_t.name ILIKE ${searchParam}
      )
      OR EXISTS (
        SELECT 1
        FROM memory_date_notes search_note
        WHERE search_note.album_date = m.uploaded_at
          AND search_note.content ILIKE ${searchParam}
      )
    )`);
  }
  if (tag) {
    const tagParam = addParam(`%${tag}%`);
    conditions.push(`EXISTS (
      SELECT 1
      FROM media_tags filter_mt
      JOIN tags filter_t ON filter_t.id = filter_mt.tag_id
      WHERE filter_mt.media_id = m.id
        AND filter_t.name ILIKE ${tagParam}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = limit
    ? `LIMIT ${addParam(limit)} OFFSET ${addParam(offset)}`
    : '';

  const result = await pgDb.query(`
    ${MEDIA_WITH_TAGS_SELECT}
    ${whereClause}
    GROUP BY m.id
    ORDER BY m.created_at DESC
    ${limitClause}
  `, params);

  return result.rows;
};

const listFavoriteMedia = async (userId) => {
  if (!userId) throw new HttpError(400, '사용자 정보가 필요합니다');
  const userResult = await pgDb.query('SELECT id, category, role FROM users WHERE id = $1', [userId]);
  if (!userResult.rows.length) throw new HttpError(404, '사용자를 찾을 수 없습니다');
  const user = userResult.rows[0];
  const result = await pgDb.query(`
    ${MEDIA_WITH_TAGS_SELECT}
    JOIN user_favorite_media ufm ON ufm.media_id = m.id
    WHERE ufm.user_id = $1
      AND (
        $2::text IN ('admin', 'sub-admin')
        OR $3::text = ANY(m.shared_with)
        OR m.uploaded_by = $1
      )
    GROUP BY m.id, ufm.created_at
    ORDER BY ufm.created_at DESC
  `, [userId, user.role, user.category]);
  return result.rows;
};

const listLikedMedia = async (userId) => {
  if (!userId) throw new HttpError(400, '사용자 정보가 필요합니다');
  const userResult = await pgDb.query('SELECT id, category, role FROM users WHERE id = $1', [userId]);
  if (!userResult.rows.length) throw new HttpError(404, '사용자를 찾을 수 없습니다');
  const user = userResult.rows[0];
  const result = await pgDb.query(`
    ${MEDIA_WITH_TAGS_SELECT}
    JOIN user_liked_media ulm ON ulm.media_id = m.id
    WHERE ulm.user_id = $1
      AND (
        $2::text IN ('admin', 'sub-admin')
        OR $3::text = ANY(m.shared_with)
        OR m.uploaded_by = $1
      )
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `, [userId, user.role, user.category]);
  return result.rows;
};

const getMedia = async (id) => {
  const result = await pgDb.query(`
    ${MEDIA_WITH_TAGS_SELECT}
    WHERE m.id = $1
    GROUP BY m.id
  `, [id]);

  if (result.rows.length === 0) {
    throw new HttpError(404, "비디오를 찾을 수 없습니다");
  }

  return result.rows[0];
};

const getMediaDateRange = async () => {
  const result = await pgDb.query(`
    SELECT
      TO_CHAR(MIN(uploaded_at), 'YYYY-MM-DD') AS min_date,
      TO_CHAR(MAX(uploaded_at), 'YYYY-MM-DD') AS max_date
    FROM media
    WHERE uploaded_at IS NOT NULL
  `);

  return result.rows[0] || { min_date: null, max_date: null };
};

const getCalendarMedia = async ({ viewerId, viewerCategory, viewerRole }) => {
  const params = [viewerId, viewerCategory, viewerRole];
  const accessCondition = `(
    $3::text IN ('admin', 'sub-admin')
    OR $2::text = ANY(m.shared_with)
    OR m.uploaded_by = $1
  )`;

  const [datesResult, unreadResult] = await Promise.all([
    pgDb.query(`
      SELECT TO_CHAR(m.uploaded_at, 'YYYY-MM-DD') AS date
      FROM media m
      WHERE m.uploaded_at IS NOT NULL
        AND ${accessCondition}
      GROUP BY m.uploaded_at
      ORDER BY m.uploaded_at DESC
    `, params),
    pgDb.query(`
      SELECT
        m.id,
        m.title,
        m.media_type,
        m.content_type,
        m.youtube_url,
        m.file_path,
        m.thumbnail_url,
        m.thumbnail_path,
        m.uploaded_at,
        m.upload_batch_id,
        m.created_at,
        m.updated_at
      FROM media m
      WHERE m.uploaded_at IS NOT NULL
        AND ${accessCondition}
        AND NOT EXISTS (
          SELECT 1
          FROM user_watched_media uwm
          JOIN media watched_media ON watched_media.id = uwm.media_id
          WHERE uwm.user_id = $1
            AND COALESCE(watched_media.upload_batch_id, watched_media.id)
              = COALESCE(m.upload_batch_id, m.id)
        )
      ORDER BY m.created_at DESC
    `, params),
  ]);

  return {
    dates: datesResult.rows.map((row) => row.date),
    unreadMedia: unreadResult.rows,
  };
};

const mediaExists = async (db, id) => {
  const result = await db.query("SELECT 1 FROM media WHERE id = $1", [id]);
  return result.rows.length > 0;
};

const getMediaAccess = async (db, mediaId, userId) => {
  if (!userId) return null;
  const result = await db.query(`
    SELECT m.id, m.uploaded_by, m.shared_with, u.category, u.role,
      (u.role IN ('admin', 'sub-admin') OR u.category = ANY(m.shared_with) OR m.uploaded_by = u.id) AS can_view,
      (u.role IN ('admin', 'sub-admin') OR m.uploaded_by = u.id) AS can_modify
    FROM media m
    JOIN users u ON u.id = $2
    WHERE m.id = $1
  `, [mediaId, userId]);
  return result.rows[0] || null;
};

const createMedia = async ({
  videoId,
  title,
  description,
  youtubeUrl,
  thumbnailUrl,
  type,
  year,
  tags,
  uploadedAt,
  durationSeconds,
  viewCount,
  likeCount,
  channelTitle,
  uploadedBy,
  sharedWith,
}) => {
  let client;

  if (!videoId || !title || !youtubeUrl || !thumbnailUrl) {
    throw new HttpError(400, "필수 영상 정보가 누락되었습니다");
  }

  try {
    client = await pgDb.getClient();
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM media WHERE id = $1", [videoId]);
    if (existing.rows.length > 0) {
      throw new HttpError(400, "이미 등록된 영상입니다");
    }

    const now = new Date().toISOString();
    await client.query(`
      INSERT INTO media (
        id, title, description, content_type, media_type, youtube_url, file_path,
        thumbnail_url, thumbnail_path, year, uploaded_at, duration_seconds,
        view_count, like_count, channel_title, uploaded_by, shared_with, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'youtube', $5, NULL, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [
      videoId,
      title,
      description || "",
      toContentType(type),
      youtubeUrl,
      thumbnailUrl,
      year || null,
      uploadedAt || null,
      durationSeconds || null,
      viewCount || 0,
      likeCount || 0,
      channelTitle || null,
      uploadedBy || null,
      Array.isArray(sharedWith) && sharedWith.length ? sharedWith : ['dad', 'mom'],
      now,
      now,
    ]);

    await replaceMediaTags(client, videoId, tags);
    const createdMedia = await fetchMediaById(client, videoId);
    await client.query("COMMIT");

    return createdMedia;
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

const createFileMedia = async ({
  id,
  title,
  filePath,
  thumbnailPath = null,
  mediaType,
  tags,
  uploadedAt,
  uploadedBy = null,
  sharedWith = ['dad', 'mom'],
  uploadBatchId = null,
  contentHash = null,
}) => {
  let client;

  if (!id || !title || !filePath || !['photo', 'video'].includes(mediaType) || !uploadedAt) {
    throw new HttpError(400, '필수 파일 정보가 누락되었습니다');
  }

  try {
    client = await pgDb.getClient();
    await client.query('BEGIN');
    const now = new Date().toISOString();
    await client.query(`
      INSERT INTO media (
        id, title, description, content_type, media_type, youtube_url, file_path,
        thumbnail_url, thumbnail_path, year, uploaded_at, duration_seconds,
        view_count, like_count, channel_title, uploaded_by, shared_with, upload_batch_id, content_hash, created_at, updated_at
      )
      VALUES ($1, $2, '', NULL, $3, NULL, $4, NULL, $5, $6, $7, NULL, 0, 0, NULL, $8, $9, $10, $11, $12, $12)
    `, [id, title, mediaType, filePath, thumbnailPath, Number(uploadedAt.slice(0, 4)), uploadedAt, uploadedBy, sharedWith, uploadBatchId, contentHash, now]);

    await replaceMediaTags(client, id, tags);
    const createdMedia = await fetchMediaById(client, id);
    await client.query('COMMIT');
    return createdMedia;
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505' && error.constraint === 'idx_media_content_hash') {
      throw new HttpError(409, '이미 업로드된 사진 또는 영상입니다.', 'DUPLICATE_MEDIA');
    }
    throw error;
  } finally {
    client?.release();
  }
};

const updateMedia = async (id, {
  title,
  description,
  youtubeUrl,
  thumbnailUrl,
  type,
  year,
  tags,
  uploadedAt,
  durationSeconds,
  viewCount,
  likeCount,
  channelTitle,
  sharedWith,
}) => {
  let client;

  try {
    client = await pgDb.getClient();
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM media WHERE id = $1 FOR UPDATE", [id]);
    if (existing.rows.length === 0) {
      throw new HttpError(404, "비디오를 찾을 수 없습니다");
    }

    await client.query(`
      UPDATE media
      SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        content_type = COALESCE($4, content_type),
        youtube_url = COALESCE($5, youtube_url),
        thumbnail_url = COALESCE($6, thumbnail_url),
        year = COALESCE($7, year),
        uploaded_at = COALESCE($8, uploaded_at),
        duration_seconds = COALESCE($9, duration_seconds),
        view_count = COALESCE($10, view_count),
        like_count = COALESCE($11, like_count),
        channel_title = COALESCE($12, channel_title),
        shared_with = COALESCE($13, shared_with),
        updated_at = $14
      WHERE id = $1
    `, [
      id,
      title ?? null,
      description ?? null,
      type ? toContentType(type) : null,
      youtubeUrl ?? null,
      thumbnailUrl ?? null,
      year ?? null,
      uploadedAt ?? null,
      durationSeconds ?? null,
      viewCount ?? null,
      likeCount ?? null,
      channelTitle ?? null,
      Array.isArray(sharedWith) ? sharedWith : null,
      new Date().toISOString(),
    ]);

    if (Array.isArray(tags)) {
      await replaceMediaTags(client, id, tags);
    }

    const updatedMedia = await fetchMediaById(client, id);
    await client.query("COMMIT");

    return updatedMedia;
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

const deleteMedia = async (id) => {
  let client;

  try {
    client = await pgDb.getClient();
    await client.query("BEGIN");

    const linkedTags = await client.query('SELECT tag_id FROM media_tags WHERE media_id = $1', [id]);
    const deleted = await client.query("DELETE FROM media WHERE id = $1 RETURNING id, file_path, thumbnail_path", [id]);
    if (deleted.rows.length === 0) {
      throw new HttpError(404, "비디오를 찾을 수 없습니다");
    }

    await cleanupOrphanTags(client, linkedTags.rows.map((row) => row.tag_id));
    await client.query("COMMIT");
    return deleted.rows[0];
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

const deleteMediaByDate = async (uploadedAt) => {
  let client;
  try {
    client = await pgDb.getClient();
    await client.query("BEGIN");
    const linkedTags = await client.query(`
      SELECT DISTINCT mt.tag_id
      FROM media_tags mt
      JOIN media m ON m.id = mt.media_id
      WHERE m.uploaded_at = $1
    `, [uploadedAt]);
    const deleted = await client.query(`
      DELETE FROM media
      WHERE uploaded_at = $1
      RETURNING id, file_path, thumbnail_path
    `, [uploadedAt]);
    await cleanupOrphanTags(client, linkedTags.rows.map((row) => row.tag_id));
    await client.query("COMMIT");
    return deleted.rows;
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client?.release();
  }
};

const replaceMediaTags = async (client, mediaId, tags) => {
  const normalizedTags = normalizeTags(tags);
  const previousTags = await client.query('SELECT tag_id FROM media_tags WHERE media_id = $1', [mediaId]);

  await client.query("DELETE FROM media_tags WHERE media_id = $1", [mediaId]);

  for (const tag of normalizedTags) {
    const tagResult = await client.query(`
      INSERT INTO tags (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [tag]);

    await client.query(`
      INSERT INTO media_tags (media_id, tag_id)
      VALUES ($1, $2)
      ON CONFLICT (media_id, tag_id) DO NOTHING
    `, [mediaId, tagResult.rows[0].id]);
  }

  await cleanupOrphanTags(client, previousTags.rows.map((row) => row.tag_id));
};

module.exports = {
  createFileMedia,
  createMedia,
  deleteMedia,
  deleteMediaByDate,
  getMedia,
  getCalendarMedia,
  getMediaDateRange,
  getMediaAccess,
  listFavoriteMedia,
  listLikedMedia,
  listMedia,
  mediaExists,
  updateMedia,
};
