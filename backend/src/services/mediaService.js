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

  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
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

const listMedia = async (contentType = null) => {
  const whereClause = contentType ? "WHERE m.content_type = $1" : "";
  const params = contentType ? [contentType] : [];

  const result = await pgDb.query(`
    ${MEDIA_WITH_TAGS_SELECT}
    ${whereClause}
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `, params);

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

const mediaExists = async (db, id) => {
  const result = await db.query("SELECT 1 FROM media WHERE id = $1", [id]);
  return result.rows.length > 0;
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
        view_count, like_count, channel_title, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'youtube', $5, NULL, $6, NULL, $7, $8, $9, $10, $11, $12, $13, $14)
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
  mediaType,
  tags,
  uploadedAt,
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
        view_count, like_count, channel_title, created_at, updated_at
      )
      VALUES ($1, $2, '', 'long', $3, NULL, $4, NULL, NULL, $5, $6, NULL, 0, 0, NULL, $7, $7)
    `, [id, title, mediaType, filePath, Number(uploadedAt.slice(0, 4)), uploadedAt, now]);

    await replaceMediaTags(client, id, tags);
    const createdMedia = await fetchMediaById(client, id);
    await client.query('COMMIT');
    return createdMedia;
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
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
        updated_at = $13
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

    const deleted = await client.query("DELETE FROM media WHERE id = $1 RETURNING id, file_path, thumbnail_path", [id]);
    if (deleted.rows.length === 0) {
      throw new HttpError(404, "비디오를 찾을 수 없습니다");
    }

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

const replaceMediaTags = async (client, mediaId, tags) => {
  const normalizedTags = normalizeTags(tags);

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
};

module.exports = {
  createFileMedia,
  createMedia,
  deleteMedia,
  getMedia,
  listMedia,
  mediaExists,
  updateMedia,
};
