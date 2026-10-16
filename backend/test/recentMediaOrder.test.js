const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { listMedia } = require('../src/services/mediaService');

test('recent media uses photo dates for ordering and subsequent pages', async (t) => {
  const cursor = { uploadedAt: '2026-10-15', id: 'photo-2' };
  t.mock.method(db, 'query', async (sql, params) => {
    assert.match(sql, /ORDER BY COALESCE\(m\.uploaded_at, '1970-01-01'::date\) DESC, m\.id DESC/);
    assert.match(sql, /\(COALESCE\(m\.uploaded_at, '1970-01-01'::date\), m\.id\) < \(\$1::date, \$2::text\)/);
    assert.deepEqual(params, [cursor.uploadedAt, cursor.id, 13]);
    assert.match(sql, /m\.media_type IN \('photo', 'video'\)/);
    return { rows: [] };
  });
  await listMedia({ sort: 'date', cursor, source: 'file', viewerRole: 'admin', limit: 13 });
});

test('other media lists retain creation time ordering', async (t) => {
  t.mock.method(db, 'query', async (sql, params) => {
    assert.match(sql, /ORDER BY COALESCE\(m\.created_at, 'epoch'::timestamptz\) DESC, m\.id DESC/);
    assert.deepEqual(params, ['2026-10-16T00:00:00Z', 'photo-1', 13]);
    return { rows: [] };
  });
  await listMedia({ cursor: { createdAt: '2026-10-16T00:00:00Z', id: 'photo-1' }, viewerRole: 'admin', limit: 13 });
});
