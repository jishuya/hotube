const pgDb = require("../db");

const fetchCommentById = async (id) => {
  const result = await pgDb.query("SELECT * FROM comments WHERE id = $1", [id]);
  return result.rows[0] || null;
};

module.exports = {
  fetchCommentById,
};
