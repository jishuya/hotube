const pgDb = require('../db');
const { HttpError } = require('../httpErrors');

const listDateAlbumTags = async (dateFrom, dateTo) => {
  const result = await pgDb.query(`
    SELECT TO_CHAR(dat.album_date, 'YYYY-MM-DD') AS album_date, t.name
    FROM memory_date_tags dat
    JOIN tags t ON t.id = dat.tag_id
    WHERE dat.album_date >= $1 AND dat.album_date < $2
    ORDER BY dat.album_date DESC, t.name
  `, [dateFrom, dateTo]);
  return result.rows.reduce((byDate, row) => {
    if (!byDate[row.album_date]) byDate[row.album_date] = [];
    byDate[row.album_date].push(row.name);
    return byDate;
  }, {});
};

const addDateAlbumTag = async (albumDate, tag) => {
  const normalizedTag = String(tag || '').trim().replace(/^#/, '');
  if (!normalizedTag) throw new HttpError(400, '태그를 입력해주세요');
  let client;
  try {
    client = await pgDb.getClient();
    await client.query('BEGIN');
    const tagResult = await client.query(`
      INSERT INTO tags (name) VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `, [normalizedTag]);
    await client.query(`
      INSERT INTO memory_date_tags (album_date, tag_id) VALUES ($1, $2)
      ON CONFLICT (album_date, tag_id) DO NOTHING
    `, [albumDate, tagResult.rows[0].id]);
    await client.query('COMMIT');
    return { date: albumDate, tag: tagResult.rows[0].name };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client?.release();
  }
};

const deleteDateAlbumTag = async (albumDate, tag) => {
  let client;
  try {
    client = await pgDb.getClient();
    await client.query('BEGIN');
    const result = await client.query(`
      DELETE FROM memory_date_tags dat USING tags t
      WHERE dat.tag_id = t.id AND dat.album_date = $1 AND t.name = $2
      RETURNING dat.tag_id
    `, [albumDate, tag]);
    if (result.rows.length === 0) throw new HttpError(404, '날짜 태그를 찾을 수 없습니다');
    await client.query(`
      DELETE FROM tags t
      WHERE t.id = $1
        AND NOT EXISTS (SELECT 1 FROM media_tags mt WHERE mt.tag_id = t.id)
        AND NOT EXISTS (SELECT 1 FROM memory_date_tags mdt WHERE mdt.tag_id = t.id)
    `, [result.rows[0].tag_id]);
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client?.release();
  }
};

module.exports = { addDateAlbumTag, deleteDateAlbumTag, listDateAlbumTags };
