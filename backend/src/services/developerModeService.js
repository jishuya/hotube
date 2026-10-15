const pgDb = require('../db');
const { HttpError } = require('../httpErrors');

const isDeveloperMode = async (userId) => {
  if (!userId) return false;
  const result = await pgDb.query('SELECT role, developer_mode FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.role === 'admin' && result.rows[0]?.developer_mode === true;
};

const getDeveloperMode = async (userId) => {
  const result = await pgDb.query('SELECT role, developer_mode FROM users WHERE id = $1', [userId]);
  if (result.rows[0]?.role !== 'admin') throw new HttpError(403, '관리자만 개발자 모드를 사용할 수 있습니다');
  return { enabled: result.rows[0].developer_mode === true };
};

const setDeveloperMode = async (userId, enabled) => {
  if (typeof enabled !== 'boolean') throw new HttpError(400, '개발자 모드 설정값이 올바르지 않습니다');
  const result = await pgDb.query(`
    UPDATE users SET developer_mode = $2
    WHERE id = $1 AND role = 'admin'
    RETURNING developer_mode
  `, [userId, enabled]);
  if (!result.rows.length) throw new HttpError(403, '관리자만 개발자 모드를 사용할 수 있습니다');
  return { enabled: result.rows[0].developer_mode };
};

module.exports = { isDeveloperMode, getDeveloperMode, setDeveloperMode };
