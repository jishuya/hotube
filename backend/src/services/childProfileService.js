const pgDb = require('../db');

const fetchChildProfile = async (id = null, slot = 0) => {
  const result = await pgDb.query(`
    SELECT id, name, nickname, gender, birth_date, photo_path,
           created_by, updated_by, created_at, updated_at
    FROM child_profiles
    WHERE ($1::bigint IS NULL OR id = $1)
    ORDER BY id
    LIMIT 1 OFFSET $2
  `, [id, slot]);
  return result.rows[0] || null;
};

module.exports = {
  fetchChildProfile,
};
