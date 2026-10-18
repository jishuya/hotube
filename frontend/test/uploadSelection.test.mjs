import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excludeSelectedDuplicates, getDuplicateSelectionNotices, getUploadSelectionCapacity } from '../src/utils/uploadSelection.js';

test('기존 3개에 10개를 추가하면 추가 파일 전체에서 7개를 고르게 한다', () => {
  assert.deepEqual(getUploadSelectionCapacity(3, 10), { remaining: 7, needsPicker: true });
});

test('첫 첨부와 추가 첨부 모두 남은 자리를 기준으로 제한한다', () => {
  assert.deepEqual(getUploadSelectionCapacity(0, 20), { remaining: 10, needsPicker: true });
  assert.deepEqual(getUploadSelectionCapacity(3, 8), { remaining: 7, needsPicker: true });
  assert.deepEqual(getUploadSelectionCapacity(9, 2), { remaining: 1, needsPicker: true });
  assert.deepEqual(getUploadSelectionCapacity(3, 7), { remaining: 7, needsPicker: false });
  assert.deepEqual(getUploadSelectionCapacity(10, 1), { remaining: 0, needsPicker: false });
});

test('기존 첨부와 같은 내용은 이름이 달라도 제외하고 남은 파일로 선택 개수를 계산한다', async () => {
  const existing = ['a', 'b', 'c'];
  const incoming = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((hash, index) => ({ name: `새이름${index}`, hash }));
  const result = await excludeSelectedDuplicates(incoming, existing, async (file) => file.hash);
  assert.equal(result.duplicateCount, 3);
  assert.equal(result.attachedDuplicateCount, 3);
  assert.equal(result.repeatedDuplicateCount, 0);
  assert.deepEqual(result.files.map((file) => file.hash), ['d', 'e', 'f', 'g', 'h', 'i', 'j']);
  assert.deepEqual(getUploadSelectionCapacity(3, result.files.length), { remaining: 7, needsPicker: false });
});

test('새 파일 안의 중복도 제외하고 고유 파일이 남은 자리보다 많으면 선택 화면을 연다', async () => {
  const result = await excludeSelectedDuplicates(['a', 'd', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'], ['a', 'b', 'c'], async (file) => file);
  assert.equal(result.duplicateCount, 2);
  assert.equal(result.attachedDuplicateCount, 1);
  assert.equal(result.repeatedDuplicateCount, 1);
  assert.deepEqual(getUploadSelectionCapacity(3, result.files.length), { remaining: 7, needsPicker: true });
});

test('업로드된 파일과 현재 첨부된 파일은 각 사유와 개수로 안내한다', () => {
  assert.deepEqual(getDuplicateSelectionNotices({ attached: 2, uploaded: 3 }), [
    '이미 첨부한 것과 동일한 파일 2개를 제외했어요.',
    '이미 올린 것과 동일한 파일 3개를 제외했어요.',
  ]);
  assert.deepEqual(getDuplicateSelectionNotices({ uploaded: 1 }), ['이미 올린 것과 동일한 파일 1개를 제외했어요.']);
  assert.deepEqual(getDuplicateSelectionNotices({}), []);
});
