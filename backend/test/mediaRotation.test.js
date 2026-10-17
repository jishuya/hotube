const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { updateMedia } = require('../src/services/mediaService');
const { mapMediaRowToVideo } = require('../src/responseMappers');

test('invalid rotations are rejected before opening a transaction', async (t) => {
  const connect = t.mock.method(db, 'getClient', async () => { throw new Error('Unexpected connection'); });
  for (const rotation of [-90, 45, 360, '90', null]) {
    await assert.rejects(updateMedia('photo', { rotation }), { status: 400 });
  }
  assert.equal(connect.mock.callCount(), 0);
});

test('photo and video rotation persists; unrelated edits preserve it, and zero resets it', async (t) => {
  for (const mediaType of ['photo', 'video']) {
    let storedRotation = 0;
    const queries = [];
    const client = {
      query: async (sql, args) => {
        queries.push(sql);
        if (sql.includes('FOR UPDATE')) return { rows: [{ id: 'media', media_type: mediaType }] };
        if (sql.includes('UPDATE media') && args[14] !== null) storedRotation = args[14];
        return { rows: [{ id: 'media', media_type: mediaType, rotation: storedRotation }] };
      },
      release() {},
    };
    t.mock.method(db, 'getClient', async () => client);
    for (const rotation of [90, 180, 270, 0]) {
      assert.equal(mapMediaRowToVideo(await updateMedia('media', { rotation })).rotation, rotation);
      assert.equal((await updateMedia('media', { description: '기록' })).rotation, rotation);
    }
    assert.ok(queries.includes('COMMIT'));
    assert.ok(!queries.includes('ROLLBACK'));
  }
  assert.equal(mapMediaRowToVideo({}).rotation, 0);
});

test('YouTube rotation is rejected and transaction is rolled back', async (t) => {
  const queries = [];
  t.mock.method(db, 'getClient', async () => ({
    query: async (sql) => { queries.push(sql); return { rows: [{ id: 'youtube', media_type: 'youtube' }] }; },
    release() {},
  }));
  await assert.rejects(updateMedia('youtube', { rotation: 90 }), { status: 400 });
  assert.ok(queries.includes('ROLLBACK'));
  assert.ok(!queries.some((sql) => sql.includes('UPDATE media')));
});
