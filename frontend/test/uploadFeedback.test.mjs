import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInterruptedUploadFeedback, getUploadFailureMessage } from '../src/utils/uploadFeedback.js';

test('일부 완료 안내를 요청한 세 줄로 표시한다', () => {
  const result = getInterruptedUploadFeedback({ total: 10, completed: 7, reason: getUploadFailureMessage({ code: 'UPLOAD_NETWORK_ERROR' }) });
  assert.equal(result.title, '업로드 안내');
  assert.equal(result.message, '10개 중 7개 업로드\n통신문제로 중단되었습니다\n남은 파일은 다시 시도해주세요');
});
test('사용자 취소를 통신 오류로 안내하지 않는다', () => {
  const result = getInterruptedUploadFeedback({ total: 10, completed: 5, cancelled: true });
  assert.match(result.message, /업로드를 중지했습니다/);
});
test('통신 오류는 사용자 인터넷 문제로 단정하지 않는다', () => {
  assert.match(getUploadFailureMessage({ code: 'UPLOAD_NETWORK_ERROR' }), /통신문제/);
  assert.match(getUploadFailureMessage({ code: 'UPLOAD_TIMEOUT' }), /지연/);
  assert.equal(getUploadFailureMessage(new TypeError('unexpected value')), 'unexpected value');
});
