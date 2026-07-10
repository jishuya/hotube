const pgDb = require("../db");

const USER_WITH_RELATIONS_SELECT = `
  SELECT
    u.*,
    COALESCE(array_agg(DISTINCT ulm.media_id) FILTER (WHERE ulm.media_id IS NOT NULL), '{}') AS liked_videos,
    COALESCE(array_agg(DISTINCT uwm.media_id) FILTER (WHERE uwm.media_id IS NOT NULL), '{}') AS watched_videos
  FROM users u
  LEFT JOIN user_liked_media ulm ON ulm.user_id = u.id
  LEFT JOIN user_watched_media uwm ON uwm.user_id = u.id
`;

const fetchUserById = async (id) => {
  const result = await pgDb.query(`
    ${USER_WITH_RELATIONS_SELECT}
    WHERE u.id = $1
    GROUP BY u.id
  `, [id]);

  return result.rows[0] || null;
};

const fetchUserByLoginId = async (userId) => {
  const result = await pgDb.query(`
    ${USER_WITH_RELATIONS_SELECT}
    WHERE u.user_id = $1
    GROUP BY u.id
  `, [userId]);

  return result.rows[0] || null;
};

const fetchCommentAuthorById = async (id) => {
  const result = await pgDb.query("SELECT id, name, title, category FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
};

const userExists = async (db, id) => {
  const result = await db.query("SELECT 1 FROM users WHERE id = $1", [id]);
  return result.rows.length > 0;
};

module.exports = {
  fetchCommentAuthorById,
  fetchUserById,
  fetchUserByLoginId,
  userExists,
};
