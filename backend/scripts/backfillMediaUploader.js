const pgDb = require('../src/db');

const uploaderLoginId = process.env.UPLOADER_LOGIN_ID;
const apply = process.argv.includes('--apply');

const main = async () => {
  if (!uploaderLoginId) throw new Error('UPLOADER_LOGIN_ID를 지정해 주세요. 예: UPLOADER_LOGIN_ID=mom');
  const userResult = await pgDb.query('SELECT id, name, title FROM users WHERE user_id = $1', [uploaderLoginId]);
  if (!userResult.rows.length) throw new Error(`사용자를 찾을 수 없습니다: ${uploaderLoginId}`);
  const user = userResult.rows[0];
  const countResult = await pgDb.query('SELECT COUNT(*)::int AS count FROM media WHERE uploaded_by IS NULL');
  const count = countResult.rows[0].count;

  if (!apply) {
    console.log(`${count}개 미디어의 업로더를 ${user.title || user.name}로 지정할 수 있습니다.`);
    console.log('실제로 반영하려면 --apply 옵션을 추가하세요.');
    return;
  }

  const updated = await pgDb.query(
    'UPDATE media SET uploaded_by = $1, updated_at = CURRENT_TIMESTAMP WHERE uploaded_by IS NULL RETURNING id',
    [user.id],
  );
  console.log(`${updated.rowCount}개 미디어의 업로더를 ${user.title || user.name}로 지정했습니다.`);
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pgDb.pool.end());
