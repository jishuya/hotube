const pgDb = require('../db');
const { HttpError } = require('../httpErrors');

const normalizeTags = (tags) => [...new Set((Array.isArray(tags) ? tags : String(tags || '').split(','))
  .map((tag) => String(tag).trim().replace(/^#/, '').normalize('NFC'))
  .filter(Boolean))];

const requireUser = async (client, userId) => {
  if (!userId) throw new HttpError(401, '로그인 정보가 필요합니다');
  const result = await client.query('SELECT id, role FROM users WHERE id = $1', [userId]);
  if (!result.rows.length) throw new HttpError(401, '로그인 정보를 확인할 수 없습니다');
  return result.rows[0];
};

const listMemoryDateNotes = async (dateFrom, dateTo, userId) => {
  const client = await pgDb.getClient();
  try {
    await requireUser(client, userId);
    const result = await client.query(`
      SELECT TO_CHAR(album_date, 'YYYY-MM-DD') AS album_date, content, created_by
      FROM memory_date_notes
      WHERE album_date >= $1 AND album_date < $2
      ORDER BY album_date DESC
    `, [dateFrom, dateTo]);
    return Object.fromEntries(result.rows.map((row) => [row.album_date, {
      content: row.content,
      createdBy: row.created_by,
    }]));
  } finally {
    client.release();
  }
};

const saveMemoryDateNote = async (albumDate, content, userId) => {
  const normalizedContent = String(content || '').trim();
  const client = await pgDb.getClient();
  try {
    await client.query('BEGIN');
    const user = await requireUser(client, userId);
    const existing = await client.query(
      'SELECT created_by FROM memory_date_notes WHERE album_date = $1 FOR UPDATE',
      [albumDate],
    );
    if (existing.rows.length
      && existing.rows[0].created_by !== userId
      && !['admin', 'sub-admin'].includes(user.role)) {
      throw new HttpError(403, '메모 작성자 또는 관리자만 수정할 수 있습니다');
    }
    if (!normalizedContent) {
      await client.query('DELETE FROM memory_date_notes WHERE album_date = $1', [albumDate]);
    } else {
      await client.query(`
        INSERT INTO memory_date_notes (album_date, content, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (album_date) DO UPDATE
        SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
      `, [albumDate, normalizedContent, userId]);
    }
    await client.query('COMMIT');
    return {
      date: albumDate,
      content: normalizedContent,
      createdBy: existing.rows[0]?.created_by || userId,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const deleteMemoryDateNote = async (albumDate, userId) => {
  const client = await pgDb.getClient();
  try {
    await client.query('BEGIN');
    const user = await requireUser(client, userId);
    const result = await client.query(`
      DELETE FROM memory_date_notes
      WHERE album_date = $1
        AND (created_by = $2 OR $3::text IN ('admin', 'sub-admin'))
      RETURNING album_date
    `, [albumDate, userId, user.role]);
    if (!result.rows.length) throw new HttpError(404, '삭제할 메모를 찾을 수 없습니다');
    await client.query('COMMIT');
    return { date: albumDate };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const addTagsToDateMedia = async (albumDate, tags, userId) => {
  const normalizedTags = normalizeTags(tags);
  if (!normalizedTags.length) throw new HttpError(400, '태그를 입력해주세요');
  const client = await pgDb.getClient();
  try {
    await client.query('BEGIN');
    const user = await requireUser(client, userId);
    let addedCount = 0;
    for (const tag of normalizedTags) {
      const tagResult = await client.query(`
        INSERT INTO tags (name) VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [tag]);
      const result = await client.query(`
        INSERT INTO media_tags (media_id, tag_id)
        SELECT m.id, $2
        FROM media m
        WHERE m.uploaded_at = $1
          AND ($3::text IN ('admin', 'sub-admin') OR m.uploaded_by = $4)
        ON CONFLICT (media_id, tag_id) DO NOTHING
        RETURNING media_id
      `, [albumDate, tagResult.rows[0].id, user.role, user.id]);
      addedCount += result.rowCount;
    }
    await client.query('COMMIT');
    return { date: albumDate, tags: normalizedTags, addedCount };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { addTagsToDateMedia, deleteMemoryDateNote, listMemoryDateNotes, saveMemoryDateNote };
