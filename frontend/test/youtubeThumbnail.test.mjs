import test from 'node:test';
import assert from 'node:assert/strict';
import { getYoutubeThumbnail, getMediaThumbnail } from '../src/utils/youtubeThumbnail.js';
import { toMemoryMedia } from '../src/services/videoApi.js';

const id = 'abcdefghijk';
const fallback = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

test('import chooses the best supplied thumbnail and handles missing metadata', () => {
  assert.equal(getYoutubeThumbnail(id, { high: { url: 'high' }, maxres: { url: 'max' } }), 'max');
  assert.equal(getYoutubeThumbnail(id, { default: { url: 'small' } }), 'small');
  assert.equal(getYoutubeThumbnail(id, null), fallback);
  assert.equal(getYoutubeThumbnail('invalid'), null);
});

test('existing YouTube records get thumbnails and small previews from supported URLs', () => {
  for (const youtubeUrl of [
    `https://www.youtube.com/watch?v=${id}&t=10`,
    `https://youtu.be/${id}?si=share`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ]) {
    const media = toMemoryMedia({ mediaType: 'youtube', youtubeUrl });
    assert.equal(media.thumbnail, fallback);
    assert.equal(media.preview, fallback);
    assert.equal(getMediaThumbnail(media), fallback);
  }
});

test('saved thumbnails and previews take precedence; file media stays unchanged', () => {
  const media = toMemoryMedia({ mediaType: 'youtube', thumbnailUrl: 'saved', previewUrl: 'preview' });
  assert.equal(media.thumbnail, 'saved');
  assert.equal(media.preview, 'preview');
  assert.equal(getMediaThumbnail({ mediaType: 'video', fileUrl: 'file.mp4' }), null);
  assert.equal(toMemoryMedia({ mediaType: 'photo', fileUrl: 'photo.jpg' }).thumbnail, 'photo.jpg');
});
