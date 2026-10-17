import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lockBodyScroll } from '../src/utils/bodyScrollLock.js';

test('업로드 창이 진행 창보다 먼저 닫혀도 마지막 창이 닫히면 스크롤을 복구한다', () => {
  globalThis.document = { body: { style: { overflow: '' } } };
  const closeUpload = lockBodyScroll();
  const closeProgress = lockBodyScroll();
  closeUpload();
  assert.equal(document.body.style.overflow, 'hidden');
  closeProgress();
  assert.equal(document.body.style.overflow, '');
});

test('완료 안내창이 열려 있으면 잠금을 유지하고 원래 스타일을 한 번만 복구한다', () => {
  globalThis.document = { body: { style: { overflow: 'auto' } } };
  const closeUpload = lockBodyScroll();
  const closeProgress = lockBodyScroll();
  const closeSuccess = lockBodyScroll();
  closeProgress();
  closeUpload();
  closeUpload();
  assert.equal(document.body.style.overflow, 'hidden');
  closeSuccess();
  assert.equal(document.body.style.overflow, 'auto');
});

test('사진 확대 중 팝업이 열린 상태로 페이지를 떠나도 잠금을 복구하고 다시 확대할 수 있다', () => {
  globalThis.document = { body: { style: { overflow: '' } } };
  const closeViewer = lockBodyScroll();
  const closeDialog = lockBodyScroll();
  closeViewer();
  assert.equal(document.body.style.overflow, 'hidden');
  closeDialog();
  assert.equal(document.body.style.overflow, '');

  const closeReopenedViewer = lockBodyScroll();
  const closeReopenedDialog = lockBodyScroll();
  closeReopenedDialog();
  assert.equal(document.body.style.overflow, 'hidden');
  closeReopenedViewer();
  assert.equal(document.body.style.overflow, '');
});
