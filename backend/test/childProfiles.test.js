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
      if (sql.includes('COUNT(*)')) return { rows: [{ count: 2 }] };
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

test('empty database accepts first, second, then third without creating default children', async (t) => {
  const rows = [];
  t.mock.method(db, 'getClient', async () => ({
    async query(sql, params) {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: rows.length }] };
      if (sql.startsWith('SELECT id, photo_path')) return { rows: rows.slice(params[0], params[0] + 1) };
      if (sql.includes('INSERT INTO child_profiles')) {
        assert.ok(params, 'must not seed hardcoded children');
        const [name, nickname, gender, birth_date, photo_path] = params;
        const row = { id: rows.length + 1, name, nickname, gender, birth_date, photo_path };
        rows.push(row);
        return { rows: [row] };
      }
      return { rows: [] };
    },
    release() {},
  }));
  t.mock.method(db, 'query', async (_, [id, slot]) => ({
    rows: id === null ? rows.slice(slot, slot + 1) : rows.filter((row) => row.id === id),
  }));
  t.mock.method(console, 'error', () => {});
  const handler = router.stack.find((layer) => layer.route?.methods.put).route.stack[0].handle;
  const save = async (slot) => {
    let status = 200;
    let body;
    await handler({ query: { slot: String(slot) }, body: { name: `아이${slot + 1}`, gender: 'female', birthday: '2025-01-01' } }, {
      status(value) { status = value; return this; },
      json(value) { body = value; return this; },
    });
    return { status, body };
  };
  assert.equal(await fetchChildProfile(null, 0), null);
  const skippedFirst = await save(1);
  assert.equal(skippedFirst.status, 409);
  assert.equal(skippedFirst.body.error, '첫째 정보를 먼저 저장해주세요.');
  assert.equal(rows.length, 0);
  for (let slot = 0; slot < 3; slot += 1) {
    const saved = await save(slot);
    assert.equal(saved.status, 200);
    assert.equal(rows.length, slot + 1);
    assert.equal(saved.body.name, `아이${slot + 1}`);
    const reloaded = await fetchChildProfile(null, slot);
    assert.equal(reloaded.name, `아이${slot + 1}`);
    assert.equal(reloaded.photo_path, null);
  }
  assert.deepEqual(rows.map((row) => row.name), ['아이1', '아이2', '아이3']);
});
