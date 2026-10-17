const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { listUserAlbums } = require('../src/services/userAlbumService');

test('album covers return the saved direction of their cover media', async (t) => {
  t.mock.method(db, 'query', async (sql) => {
    if (sql.includes('FROM users')) return { rows: [{ id: 'viewer' }] };
    assert.match(sql, /cover\.rotation AS cover_rotation/);
    assert.match(sql, /SELECT m\.id,.*m\.rotation/);
    return { rows: [{ id: 'album', cover_media_id: 'photo', cover_thumbnail_path: 'thumb.webp', cover_rotation: 90 }] };
  });
  const albums = await listUserAlbums('viewer');
  assert.equal(albums[0].coverRotation, 90);
  assert.equal(albums[0].coverMediaId, 'photo');
});
