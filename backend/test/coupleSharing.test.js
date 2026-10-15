const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { createMedia, createFileMedia } = require('../src/services/mediaService');

for (const source of ['youtube', 'file']) {
  test(`${source} preserves couple-only sharing and defaults omitted sharing to both families`, async (t) => {
    let savedSharing;
    t.mock.method(db, 'getClient', async () => ({
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO media (')) savedSharing = params[source === 'youtube' ? 13 : 9];
        return { rows: [] };
      },
      release() {},
    }));
    const create = source === 'youtube' ? createMedia : createFileMedia;
    const input = {
      id: 'photo', videoId: 'youtube', title: 'test', youtubeUrl: 'https://youtu.be/test',
      thumbnailUrl: 'https://example.com/thumb.jpg', filePath: '/test.jpg',
      mediaType: 'photo', uploadedAt: '2026-10-15', uploadedBy: 'parent',
    };
    await create({ ...input, sharedWith: [] });
    assert.deepEqual(savedSharing, []);
    await create(input);
    assert.deepEqual(savedSharing, ['dad', 'mom']);
  });
}
