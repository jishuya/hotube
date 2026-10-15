const test = require('node:test');
const assert = require('node:assert/strict');
const { getDefaultSharedWith, resolveCommentSharing } = require('../src/services/familySharing');

test('family defaults prioritize parent roles and otherwise follow family membership', () => {
  for (const role of ['admin', 'sub-admin']) {
    for (const category of ['mom', 'dad']) assert.deepEqual(getDefaultSharedWith({ role, category }), ['dad', 'mom']);
  }
  for (const category of ['mom', 'dad']) {
    assert.deepEqual(getDefaultSharedWith({ role: 'user', category }), [category]);
    assert.deepEqual(resolveCommentSharing(undefined, { role: 'user', category }), [category]);
  }
  assert.deepEqual(getDefaultSharedWith({ role: 'user', category: 'etc' }), ['dad', 'mom']);
});

test('explicit comment audience is preserved and invalid audiences are rejected', () => {
  const user = { role: 'admin', category: 'mom' };
  assert.deepEqual(resolveCommentSharing(['dad', 'mom'], user), ['dad', 'mom']);
  assert.deepEqual(resolveCommentSharing([], user), []);
  for (const value of [['unknown'], 'mom', null]) {
    assert.throws(() => resolveCommentSharing(value, user), { status: 400 });
  }
});

test('upload UI defaults parents to couple-only and relatives to their family', async () => {
  const frontend = await import('../../frontend/src/utils/familySharing.js');
  for (const role of ['admin', 'sub-admin', 'user']) {
    for (const category of ['mom', 'dad', 'etc']) {
      const user = { role, category };
      assert.deepEqual(frontend.getDefaultSharedWith(user), role === 'user' ? getDefaultSharedWith(user) : []);
    }
  }
});

test('comment notifications apply both media access and the selected comment audience', async (t) => {
  const db = require('../src/db');
  const { notifyNewComment } = require('../src/services/pushNotificationService');
  let checkedAudience = false;
  t.mock.method(db, 'query', async (sql, params) => {
    if (sql.includes('SELECT role, developer_mode')) return { rows: [{ role: 'user' }] };
    assert.match(sql, /u.category = ANY\(m.shared_with\)/);
    assert.match(sql, /u.category = ANY\(\$3::text\[\]\)/);
    assert.deepEqual(params, ['media', 'aunt', ['mom']]);
    checkedAudience = true;
    return { rows: [] };
  });
  await notifyNewComment({ mediaId: 'media', commenter: { id: 'aunt' }, content: 'hello', sharedWith: ['mom'] });
  assert.equal(checkedAudience, true);
});


test('ordinary relatives cannot expose comments to the other family even with a forged audience', () => {
  for (const category of ['mom', 'dad', 'etc']) {
    for (const requested of [undefined, ['mom', 'dad'], ['dad'], ['mom'], [], null]) {
      assert.deepEqual(resolveCommentSharing(requested, { role: 'user', category }), [category]);
    }
  }
});


test('parent comments default to couple-only while allowing either or both families', async () => {
  const frontend = await import('../../frontend/src/utils/familySharing.js');
  for (const role of ['admin', 'sub-admin']) {
    for (const category of ['mom', 'dad', 'etc']) {
      const user = { role, category };
      assert.deepEqual(frontend.getDefaultCommentSharedWith(user), []);
      assert.deepEqual(resolveCommentSharing(undefined, user), []);
      for (const audience of [[], ['mom'], ['dad'], ['mom', 'dad']]) {
        assert.deepEqual(resolveCommentSharing(audience, user), audience);
      }
      assert.deepEqual(frontend.getDefaultSharedWith(user), []);
    }
  }
});
