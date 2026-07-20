const pgDb = require('../db');

const fetchChildProfile = async () => {
  const result = await pgDb.query(`
    SELECT id, name, nickname, gender, birth_date, photo_path,
           created_by, updated_by, created_at, updated_at
    FROM child_profiles
    ORDER BY id
    LIMIT 1
  `);
  return result.rows[0] || null;
};

module.exports = {
  fetchChildProfile,
};
