import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { indexedDB, IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { hashFileChunks } from '../src/utils/fileHashChunks.js';
import { uploadRequest, retryUploadChunk } from '../src/services/uploadTransport.js';
import { savePendingUpload, removePendingUpload, listPendingUploadIds, listPendingUploadSummaries, getPendingUpload } from '../src/services/uploadQueueDb.js';
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

test('이미 전송된 조각은 건너뛰고 남은 조각을 전송한다', async () => {
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
  assert.equal(requests.length, 3); // init + two already started chunks
  assert.ok(requests.every((request) => !request.url.endsWith('/complete')));
});

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('최대 두 조각을 전송하고 역순 응답에도 진행률과 완료 순서를 보장한다', async () => {
  const pending = new Map();
  let active = 0;
  let maximum = 0;
  const progress = [];
  respond = (xhr) => {
    if (xhr.url.endsWith('/init')) return ok(xhr, { sessionId: 'parallel', chunkSize: 3, totalChunks: 4 });
    if (xhr.url.endsWith('/complete')) {
      assert.equal(active, 0);
      assert.equal(pending.size, 0);
      return ok(xhr, { id: 'done' });
    }
    const index = Number(xhr.url.split('/').at(-1));
    active++;
    maximum = Math.max(maximum, active);
    pending.set(index, () => { active--; pending.delete(index); ok(xhr); });
    xhr.upload.onprogress({ loaded: 3 });
  };
  const task = uploadMediaFile(new File(['abcdefghijkl'], 'a.mp4'), {}, { onProgress: (value) => progress.push(value) });
  await tick();
  assert.deepEqual([...pending.keys()], [0, 1]);
  pending.get(1)(); await tick();
  assert.deepEqual([...pending.keys()], [0, 2]);
  pending.get(2)(); await tick();
  pending.get(3)(); await tick();
  assert.ok(!requests.some((xhr) => xhr.url.endsWith('/complete')));
  pending.get(0)();
  assert.equal((await task).id, 'done');
  assert.equal(maximum, 2);
  assert.ok(progress.every(({ loaded }) => loaded >= 0 && loaded <= 12));
  assert.equal(progress.at(-1).loaded, 12);
});

test('한 조각의 영구 실패 시 다른 요청을 취소하고 완료를 보내지 않는다', async () => {
  let aborts = 0;
  respond = (xhr) => {
    if (xhr.url.endsWith('/init')) return ok(xhr, { sessionId: 'failed', chunkSize: 3, totalChunks: 4 });
    if (xhr.url.endsWith('/0')) {
      xhr.status = 400; xhr.response = { error: 'invalid chunk' }; xhr.onload();
    } else {
      const abort = xhr.abort.bind(xhr);
      xhr.abort = () => { aborts++; abort(); };
    }
  };
  await assert.rejects(uploadMediaFile(new File(['abcdefghijkl'], 'a.mp4'), {}), { status: 400 });
  assert.equal(aborts, 1);
  assert.equal(requests.length, 3);
});

test('재시도가 발생하면 남은 조각은 한 요청씩 전송한다', async () => {
  let attempts = 0;
  let active = 0;
  const chunkOrder = [];
  respond = (xhr) => {
    if (xhr.url.endsWith('/init')) return ok(xhr, { sessionId: 'retry', chunkSize: 3, totalChunks: 4 });
    if (xhr.url.endsWith('/complete')) return ok(xhr, { id: 'done' });
    const index = Number(xhr.url.split('/').at(-1));
    chunkOrder.push(index);
    if (index === 0 && attempts++ === 0) {
      xhr.status = 503; xhr.response = {}; xhr.onload(); return;
    }
    active++;
    setTimeout(() => { active--; ok(xhr); }, 5);
    if (index >= 2) assert.equal(active, 1);
  };
  await uploadMediaFile(new File(['abcdefghijkl'], 'a.mp4'), {});
  assert.deepEqual(chunkOrder, [0, 1, 0, 2, 3]);
});

test('재개 목록은 원본 저장소를 열지 않고 크기 정보만 읽는다', async (t) => {
  const id = crypto.randomUUID();
  await savePendingUpload({ id, userId: 'summary-user', file: new Blob(['abcdef']) });
  const stores = [];
  const transaction = IDBDatabase.prototype.transaction;
  t.mock.method(IDBDatabase.prototype, 'transaction', function (names, ...args) {
    stores.push(names); return transaction.call(this, names, ...args);
  });
  const summaries = await listPendingUploadSummaries('summary-user');
  assert.equal(summaries[0].size, 6);
  assert.equal(summaries[0].file, undefined);
  assert.deepEqual(stores, [['summaries']]);
  t.mock.restoreAll();
  await removePendingUpload(id);
  assert.deepEqual(await listPendingUploadSummaries('summary-user'), []);
});

test('기존 버전의 큐는 파일을 유지하고 크기 정보를 한 번 마이그레이션한다', async (t) => {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  t.after(() => { globalThis.indexedDB = previous; });
  const database = await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open('hotube-upload-queue', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('uploads', { keyPath: 'id' }).createIndex('userId', 'userId');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('uploads', 'readwrite');
    transaction.objectStore('uploads').put({ id: 'legacy', userId: 'a', file: new Blob(['old-file']) });
    transaction.oncomplete = resolve; transaction.onabort = () => reject(transaction.error);
  });
  database.close();
  assert.equal((await listPendingUploadSummaries('a'))[0].size, 8);
  assert.equal(await (await getPendingUpload('legacy')).file.text(), 'old-file');
});

test('완료 응답을 잃어도 조각을 다시 전송하지 않고 완료만 재시도한다', async () => {
  let attempts = 0;
  respond = (xhr) => {
    if (xhr.url.endsWith('/init')) return ok(xhr, { sessionId: 'complete-retry', chunkSize: 3, totalChunks: 1 });
    if (xhr.url.includes('/chunks/')) return ok(xhr);
    if (++attempts === 1) return xhr.onerror();
    return ok(xhr, { id: 'recovered' });
  };
  const result = await uploadMediaFile(new File(['abc'], 'a.jpg'), {});
  assert.equal(result.id, 'recovered');
  assert.equal(requests.filter((r) => r.url.includes('/chunks/')).length, 1);
  assert.equal(attempts, 2);
});
