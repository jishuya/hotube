import test from 'node:test';
import assert from 'node:assert/strict';
import { updateVideo } from '../src/services/videoApi.js';

test('rotation saving checks the angle returned by the server', async (t) => {
  let returnedRotation;
  const fetch = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).rotation, 90);
    return { ok: true, json: async () => ({ id: 'media', rotation: returnedRotation }) };
  });
  for (returnedRotation of [undefined, 0, 270]) {
    await assert.rejects(updateVideo('media', { rotation: 90 }, 'viewer'), /방향 보정이 저장되지 않았습니다/);
  }
  returnedRotation = 90;
  assert.equal((await updateVideo('media', { rotation: 90 }, 'viewer')).rotation, 90);
  assert.equal(fetch.mock.callCount(), 4);
});

test('resetting to zero is validated; other metadata edits accept older responses', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ id: 'media' }) }));
  await assert.rejects(updateVideo('media', { rotation: 0 }, 'viewer'), /방향 보정이 저장되지 않았습니다/);
  assert.equal((await updateVideo('media', { description: '기록' }, 'viewer')).id, 'media');
});
