import test from 'node:test';
import assert from 'node:assert/strict';
import { fitRotatedMedia } from '../src/utils/mediaRotation.js';

test('corrected media fits portrait and landscape viewports without clipping or distortion', () => {
  for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    for (const [availableWidth, availableHeight] of [[390, 844], [844, 390], [300, 164]]) {
      for (const rotation of [0, 90, 180, 270]) {
        const fitted = fitRotatedMedia(width, height, availableWidth, availableHeight, rotation);
        assert.ok(fitted.displayWidth <= availableWidth + 0.001);
        assert.ok(fitted.displayHeight <= availableHeight + 0.001);
        assert.ok(Math.abs(fitted.width / fitted.height - width / height) < 0.001);
        assert.equal(fitted.displayWidth, rotation % 180 ? fitted.height : fitted.width);
      }
    }
  }
});
