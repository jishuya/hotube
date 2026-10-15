import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaption, getMediaCaption, removeCaptionTag } from '../src/utils/caption.js';

test('inline hashtags are separated from the description count and deduplicated', () => {
  const result = parseCaption('첫걸음! #성장 #일상 #성장');
  assert.deepEqual(result.tags, ['성장', '일상']);
  assert.equal(result.descriptionLength, 4);
  assert.equal(result.parts.map(part => part.text).join(''), '첫걸음! #성장 #일상 #성장');
});

test('500 description characters allow additional hashtags', () => {
  assert.equal(parseCaption('가'.repeat(500) + ' #가족 #여행').descriptionLength, 500);
  assert.equal(parseCaption('가'.repeat(501) + ' #가족').descriptionLength, 501);
  assert.equal(parseCaption('#가족 #여행').descriptionLength, 0);
});

test('existing separate tags are preserved without duplicating inline tags', () => {
  assert.equal(getMediaCaption({ description: '오늘 #가족', tags: ['가족', '여행'] }), '오늘 #가족\n#여행');
  assert.equal(getMediaCaption({ tags: ['여행'] }), '#여행');
});

test('deleting a tag preserves prose and other hashtags', () => {
  assert.equal(removeCaptionTag('첫걸음 #성장 #성장기 #성장', '성장'), '첫걸음  #성장기');
  assert.deepEqual(parseCaption('＃가족 #가족, #여행!').tags, ['가족', '여행']);
  assert.equal(removeCaptionTag('＃가족', '가족'), '');
});
