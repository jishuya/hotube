const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { fetchChildProfile } = require('../src/services/childProfileService');
const router = require('../src/routes/childProfiles');

test('child lookup selects the requested banner or exact saved ID', async (t) => {
  const calls = [];
  t.mock.method(db, 'query', async (sql, params) => {
    calls.push(params);
    assert.match(sql, /WHERE \(\$1::bigint IS NULL OR id = \$1\)/);
    return { rows: [{ id: params[0] || 22 }] };
  });
  await fetchChildProfile(null, 1);
  await fetchChildProfile(22);
  assert.deepEqual(calls, [[null, 1], [22, 0]]);
});

test('saving Suyun updates only the second profile and returns that profile', async (t) => {
  const statements = [];
  const client = {
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.startsWith('SELECT id, photo_path')) {
        assert.deepEqual(params, [1]);
        return { rows: [{ id: 22, photo_path: null }] };
      }
      if (sql.includes('UPDATE child_profiles')) assert.equal(params[0], 22);
      return { rows: [] };
    },
    release() {},
  };
  t.mock.method(db, 'getClient', async () => client);
  t.mock.method(db, 'query', async (_, params) => {
    assert.deepEqual(params, [22, 0]);
    return { rows: [{ id: 22, name: '수윤', nickname: '수윤', gender: 'female', birth_date: '2025-01-01' }] };
  });
  const handler = router.stack.find((layer) => layer.route?.methods.put).route.stack[0].handle;
  let result;
  await handler({ query: { slot: '1' }, body: { name: '수윤', nickname: '수윤', gender: 'female', birthday: '2025-01-01' } }, {
    json(value) { result = value; return this; },
    status(code) { assert.fail(`Unexpected status ${code}`); },
  });
  assert.equal(result.id, 22);
  assert.equal(result.nickname, '수윤');
  assert.ok(statements.some(({ sql }) => sql === 'COMMIT'));
  assert.ok(statements.some(({ sql }) => sql.includes('LOCK TABLE')));
});

test('adding a third child without a nickname or photo inserts a separate profile and reads it back by ID', async (t) => {
  const statements = [];
  t.mock.method(db, 'getClient', async () => ({
    async query(sql, params) {
      statements.push(sql);
      if (sql.includes('COUNT(*)')) return { rows: [{ count: 2 }] };
      if (sql.startsWith('SELECT id, photo_path')) {
        assert.deepEqual(params, [2]);
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO child_profiles')) {
        assert.equal(params[0], '셋째이름');
        assert.equal(params[1], '셋째이름');
        assert.equal(params[4], null);
        return { rows: [{ id: 33 }] };
      }
      assert.ok(!sql.includes('UPDATE child_profiles'));
      return { rows: [] };
    },
    release() {},
  }));
  t.mock.method(db, 'query', async (_, params) => {
    assert.deepEqual(params, [33, 0]);
    return { rows: [{ id: 33, name: '셋째이름', nickname: '막내', gender: 'female', birth_date: '2025-01-01' }] };
  });
  const handler = router.stack.find((layer) => layer.route?.methods.put).route.stack[0].handle;
  let result;
  await handler({ query: { slot: '2' }, body: { name: '셋째이름', gender: 'female', birthday: '2025-01-01' } }, {
    json(value) { result = value; return this; },
    status(code) { assert.fail(`Unexpected status ${code}`); },
  });
  assert.equal(result.id, 33);
  assert.ok(statements.includes('COMMIT'));
});

test('third child cannot occupy the slot of an unsaved second child', async (t) => {
  const statements = [];
  t.mock.method(console, 'error', () => {});
  t.mock.method(db, 'getClient', async () => ({
    async query(sql) {
      statements.push(sql);
      if (sql.includes('COUNT(*)')) return { rows: [{ count: 1 }] };
      return { rows: [] };
    },
    release() {},
  }));
  const handler = router.stack.find((layer) => layer.route?.methods.put).route.stack[0].handle;
  let status;
  let result;
  await handler({ query: { slot: '2' }, body: { name: '셋째이름', gender: 'female', birthday: '2025-01-01' } }, {
    json(value) { result = value; return this; },
    status(code) { status = code; return this; },
  });
  assert.equal(status, 409);
  assert.equal(result.error, '첫째와 둘째 정보를 먼저 저장해주세요.');
  assert.ok(statements.includes('ROLLBACK'));
  assert.ok(!statements.some((sql) => /INSERT|UPDATE/.test(sql)));
});
