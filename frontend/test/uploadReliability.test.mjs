import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { indexedDB } from 'fake-indexeddb';
import { hashFileChunks } from '../src/utils/fileHashChunks.js';
import { uploadRequest, retryUploadChunk } from '../src/services/uploadTransport.js';
import { savePendingUpload, removePendingUpload, listPendingUploadIds, getPendingUpload } from '../src/services/uploadQueueDb.js';
import { uploadMediaFile } from '../src/services/videoApi.js';

globalThis.indexedDB = indexedDB;
globalThis.localStorage = { getItem: () => null };
let respond;
let requests;
class FakeXHR {
  upload = {};
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader() {}
  send(body) { this.body = body; requests.push(this); queueMicrotask(() => respond(this)); }
  abort() { this.onabort?.(); }
}
globalThis.XMLHttpRequest = FakeXHR;
const ok = (xhr, body = {}) => { xhr.status = 200; xhr.response = body; xhr.onload(); };
beforeEach(() => { requests = []; respond = (xhr) => ok(xhr); });

test('분할 해시는 원본 SHA-256과 같으며 한 번에 1MB만 읽는다', async () => {
  const bytes = randomBytes(3 * 1024 * 1024 + 13);
  const file = new Blob([bytes]);
  const slices = [];
  const bounded = { size: file.size, slice(start, end) {
    slices.push(end - start);
    return file.slice(start, end);
  }, arrayBuffer() { throw new Error('Whole-file read forbidden'); } };
  const progress = [];
  assert.equal(await hashFileChunks(bounded, (n) => progress.push(n)), createHash('sha256').update(bytes).digest('hex'));
  assert.ok(slices.every((size) => size <= 1024 * 1024));
  assert.equal(progress.at(-1), file.size);
});

test('분할 해시 취소 시 다음 조각을 읽지 않는다', async () => {
  const controller = new AbortController();
  let chunks = 0;
  await assert.rejects(hashFileChunks(new Blob([new Uint8Array(3 * 1024 * 1024)]), () => {
    chunks += 1; controller.abort();
  }, controller.signal), { name: 'AbortError' });
  assert.equal(chunks, 1);
});

test('임시 파일 저장 완료 후 사용자별 키와 파일을 읽고 제거한다', async () => {
  const id = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  await savePendingUpload({ id, userId: 'a', file: new Blob(['video']) });
  await savePendingUpload({ id: otherId, userId: 'b', file: new Blob(['other']) });
  assert.deepEqual(await listPendingUploadIds('a'), [id]);
  assert.equal(await (await getPendingUpload(id)).file.text(), 'video');
  await removePendingUpload(id); await removePendingUpload(otherId);
  assert.deepEqual(await listPendingUploadIds('a'), []);
});

test('취소된 임시 저장은 성공으로 처리하지 않는다', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(savePendingUpload({ id: 'cancelled', userId: 'a' }, controller.signal), { name: 'AbortError' });
  assert.equal(await getPendingUpload('cancelled'), undefined);
});

test('요청 제한시간과 취소가 대기를 종료한다', async () => {
  respond = (xhr) => xhr.ontimeout();
  await assert.rejects(uploadRequest('/timeout'), { code: 'UPLOAD_TIMEOUT' });
  const controller = new AbortController();
  respond = () => controller.abort();
  await assert.rejects(uploadRequest('/abort', { signal: controller.signal }), { name: 'AbortError' });
});

test('유효성 검사 오류는 재시도하지 않는다', async () => {
  let attempts = 0;
  await assert.rejects(retryUploadChunk(async () => { attempts++; throw Object.assign(new Error('invalid'), { status: 400 }); }));
  assert.equal(attempts, 1);
});

test('일시적 실패는 재시도하고 성공하면 종료한다', async () => {
  let attempts = 0;
  const result = await retryUploadChunk(async () => { attempts++; if (attempts === 1) throw new TypeError('offline'); return 'ok'; });
  assert.equal(result, 'ok'); assert.equal(attempts, 2);
});

test('이미 전송된 조각은 건너뛰고 남은 조각을 순서대로 전송한다', async () => {
  const file = new File(['abcdefghi'], 'sample.mp4', { type: 'video/mp4' });
  const progress = [];
  const chunks = [];
  respond = async (xhr) => {
    if (xhr.url.endsWith('/init')) return ok(xhr, { sessionId: 's', chunkSize: 3, totalChunks: 3, uploadedChunks: [0] });
    if (xhr.url.includes('/chunks/')) {
      chunks.push(await xhr.body.text());
      xhr.upload.onprogress({ loaded: xhr.body.size });
      return ok(xhr);
    }
    ok(xhr, { id: 'media', fileUrl: '/mediaFile/media' });
  };
  const result = await uploadMediaFile(file, { uploadedBy: 'a', contentHash: 'hash' }, { onProgress: (p) => progress.push(p) });
  assert.deepEqual(chunks, ['def', 'ghi']);
  assert.deepEqual(requests.map((r) => r.url), ['/uploadMedia/init', '/uploadMedia/s/chunks/1', '/uploadMedia/s/chunks/2', '/uploadMedia/s/complete']);
  assert.equal(result.id, 'media');
  assert.equal(progress.find((p) => p.phase === 'uploading').loaded, 3);
  assert.equal(progress.at(-1).phase, 'processing');
  assert.equal(progress.at(-1).loaded, 9);
});

test('전송 중지 후 추가 조각과 완료 요청을 보내지 않는다', async () => {
  const controller = new AbortController();
  respond = (xhr) => {
    if (xhr.url.endsWith('/init')) return ok(xhr, { sessionId: 's', chunkSize: 3, totalChunks: 3, uploadedChunks: [] });
    controller.abort();
  };
  await assert.rejects(uploadMediaFile(new File(['abcdefghi'], 'a.mp4'), {}, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(requests.length, 2);
});
