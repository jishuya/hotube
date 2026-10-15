import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags } from '../src/utils/tags.js';

test('hashtags support spaces, adjacent hashes, line breaks, commas and duplicates', () => {
  assert.deepEqual(parseTags('#일상 #가족#여행\n#가족,생일'), ['일상', '가족', '여행', '생일']);
  assert.deepEqual(parseTags('＃가족 #가족'), ['가족']);
  assert.deepEqual(parseTags(' ### , \n'), []);
  assert.deepEqual(parseTags('가족, 여행'), ['가족', '여행']);
  assert.deepEqual(parseTags('#첫_생일 #2026 #👶'), ['첫_생일', '2026', '👶']);
});
