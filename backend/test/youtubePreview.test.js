const test = require('node:test');
const assert = require('node:assert/strict');
const { mapMediaRowToVideo } = require('../src/responseMappers');

test('YouTube thumbnail is returned as the small preview', () => {
  const media = mapMediaRowToVideo({ media_type: 'youtube', thumbnail_url: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg' });
  assert.equal(media.previewUrl, media.thumbnailUrl);
  assert.equal(mapMediaRowToVideo({ media_type: 'video', thumbnail_url: 'thumbnail' }).previewUrl, null);
});
