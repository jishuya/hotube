const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID, createHash } = require('node:crypto');

test('업로드 재시도·재개·정리', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-sessions-'));
  process.env.MEDIA_UPLOAD_DIR = root;
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const db = require('../src/db');
  const sessions = new Map();
  const media = new Map();
  let finalizations = 0;
  const expectedPayload = new Map();
  let failCompletion = false;
  let cleanupCandidates = [];
  const stale = new Set();
  const clone = (rows) => ({ rows: structuredClone(rows) });
  t.mock.method(db, 'query', async (sql, args = []) => {
    if (sql.includes('SELECT id FROM media_upload_sessions')) return clone(cleanupCandidates.map((id) => ({ id })));
    if (sql.includes('SELECT status FROM media_upload_sessions')) return clone(stale.has(args[0]) ? [{ status: sessions.get(args[0]).status }] : []);
    if (sql.includes('SELECT 1 FROM media')) return clone([...media.values()].filter((m) => m.content_hash === args[0]));
    if (sql.includes('FROM media m')) return clone([...media.values()].filter((m) => m.id === args[0] && m.uploaded_by === args[1]));
    if (sql.includes('SELECT * FROM media_upload_sessions')) {
      if (sql.includes('WHERE user_id')) return clone([...sessions.values()].filter((s) => s.user_id === args[0] && s.content_hash === args[1] && s.file_size === args[2] && s.status === 'pending'));
      const session = sessions.get(args[0]);
      return clone(session && (!(sql.includes("status = 'pending'") || args[1] === 'pending') || session.status === 'pending') ? [session] : []);
    }
    if (sql.includes('INSERT INTO media_upload_sessions')) {
      const [id, user_id, content_hash, original_name, mime_type, file_size, total_chunks, metadata] = args;
      const session = { id, user_id, content_hash, original_name, mime_type, file_size, total_chunks, metadata: JSON.parse(metadata), status: 'pending' };
      sessions.set(id, session); return clone([session]);
    }
    if (sql.includes('UPDATE media_upload_sessions')) {
      const session = sessions.get(args[0]);
      if (sql.includes("status = 'completed'")) {
        if (failCompletion) { failCompletion = false; throw new Error('simulated DB outage'); }
        session.status = 'completed'; session.media_id = args[1];
      } else if (sql.includes("status = 'expired'")) session.status = 'expired';
      else if (sql.includes('metadata = $2')) session.metadata = JSON.parse(args[1]);
      else if (sql.includes('_tempCleaned')) session.metadata._tempCleaned = true;
      return clone([]);
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  t.mock.method(require('../src/services/userService'), 'fetchUserById', async () => ({ id: 'user' }));
  t.mock.method(require('../src/services/mediaUploadService'), 'finalizeMediaFile', async (options) => {
    finalizations++;
    assert.deepEqual(await fs.readFile(options.tempPath), expectedPayload.get(options.mediaId) || Buffer.from('abcdef'));
    await fs.unlink(options.tempPath);
    const row = { id: options.mediaId, title: options.title, uploaded_by: options.uploadedBy,
      shared_with: options.sharedWith, content_hash: options.contentHash, tags: options.tags, media_type: 'photo' };
    media.set(row.id, row);
    return row;
  });
  t.mock.method(require('../src/services/pushNotificationService'), 'notifyNewMedia', async () => {});
  const lifecycle = require('../src/services/uploadSessionLifecycle');
  const express = require('express');
  const app = express(); app.use(express.json()); app.use(require('../src/routes/uploadSessions'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = (url, body, method = 'POST') => fetch(`http://127.0.0.1:${server.address().port}${url}`, {
    method, headers: { 'Content-Type': method === 'PUT' ? 'application/octet-stream' : 'application/json' },
    body: method === 'PUT' ? body : JSON.stringify(body || {}),
  });
  const seed = async () => {
    const id = randomUUID();
    sessions.set(id, { id, user_id: 'user', content_hash: createHash('sha256').update('abcdef').digest('hex'),
      original_name: 'a.jpg', mime_type: 'image/jpeg', file_size: 6, total_chunks: 1,
      metadata: { title: 'old', uploadedAt: '2026-11-09', tags: ['tag'], sharedWith: ['mom'], _mediaId: randomUUID() }, status: 'pending' });
    await fs.mkdir(lifecycle.sessionDirectory(id), { recursive: true });
    await fs.writeFile(path.join(lifecycle.sessionDirectory(id), 'chunk-0'), 'abcdef');
    return sessions.get(id);
  };

  await t.test('완료 응답 재요청·동시 요청은 같은 미디어를 반환한다', async () => {
    const session = await seed();
    const before = finalizations;
    const responses = await Promise.all([request(`/uploadMedia/${session.id}/complete`), request(`/uploadMedia/${session.id}/complete`)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
    const rows = await Promise.all(responses.map((r) => r.json()));
    assert.equal(rows[0].id, rows[1].id);
    assert.deepEqual(rows[1].tags, ['tag']);
    assert.equal(finalizations - before, 1);
    const replay = await request(`/uploadMedia/${session.id}/complete`);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).id, rows[0].id);
  });
  await t.test('여러 조각의 경계와 순서를 보존해 원본을 조립한다', async () => {
    const session = await seed();
    const first = Buffer.alloc(5 * 1024 * 1024, 7);
    const last = Buffer.from('abcdef');
    const expected = Buffer.concat([first, last]);
    session.file_size = expected.length; session.total_chunks = 2;
    session.content_hash = createHash('sha256').update(expected).digest('hex');
    expectedPayload.set(session.metadata._mediaId, expected);
    await fs.writeFile(path.join(lifecycle.sessionDirectory(session.id), 'chunk-0'), first);
    await fs.writeFile(path.join(lifecycle.sessionDirectory(session.id), 'chunk-1'), last);
    assert.equal((await request(`/uploadMedia/${session.id}/complete`)).status, 201);
  });
  await t.test('등록 후 세션 갱신 실패도 고정 미디어 ID로 복구한다', async () => {
    const session = await seed(); failCompletion = true;
    const before = finalizations;
    assert.equal((await request(`/uploadMedia/${session.id}/complete`)).status, 500);
    const response = await request(`/uploadMedia/${session.id}/complete`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, session.metadata._mediaId);
    assert.equal(finalizations - before, 1);
  });
  await t.test('재개하면 새 설정을 반영하고 업로드된 조각은 유지한다', async () => {
    media.clear();
    sessions.clear();
    const session = await seed();
    const response = await request('/uploadMedia/init', { userId: 'user', contentHash: session.content_hash,
      originalName: 'a.jpg', mimeType: session.mime_type, fileSize: 6,
      metadata: { title: 'new', uploadedAt: '2026-11-08', tags: ['new'], sharedWith: ['dad'], _mediaId: 'untrusted' } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).uploadedChunks, [0]);
    assert.equal(session.metadata.title, 'new');
    assert.deepEqual(session.metadata.sharedWith, ['dad']);
    assert.notEqual(session.metadata._mediaId, 'untrusted');
  });
  await t.test('같은 조각의 동시 재전송은 원자적으로 저장하며 임시 파일을 남기지 않는다', async () => {
    const session = await seed();
    const responses = await Promise.all([request(`/uploadMedia/${session.id}/chunks/0`, 'abcdef', 'PUT'), request(`/uploadMedia/${session.id}/chunks/0`, 'abcdef', 'PUT')]);
    assert.ok(responses.every((r) => r.status === 200));
    assert.deepEqual(await fs.readdir(lifecycle.sessionDirectory(session.id)), ['chunk-0']);
  });
  await t.test('만료 정리는 사용 중인 세션·갱신된 세션·원본을 보존한다', async () => {
    const expired = await seed(); const renewed = await seed(); const active = await seed();
    cleanupCandidates = [expired.id, renewed.id, active.id];
    stale.add(expired.id); stale.add(active.id);
    const original = path.join(root, 'original.jpg'); await fs.writeFile(original, 'original');
    await lifecycle.withSessionLock(active.id, () => lifecycle.cleanupExpiredUploads());
    assert.equal(expired.status, 'expired');
    assert.equal(expired.metadata._tempCleaned, true);
    await assert.rejects(fs.stat(lifecycle.sessionDirectory(expired.id)), { code: 'ENOENT' });
    assert.ok(await fs.stat(lifecycle.sessionDirectory(renewed.id)));
    assert.ok(await fs.stat(lifecycle.sessionDirectory(active.id)));
    assert.equal(await fs.readFile(original, 'utf8'), 'original');
  });
  await t.test('작업 실패 후에도 다음 세션 작업이 진행된다', async () => {
    const id = randomUUID();
    await assert.rejects(lifecycle.withSessionLock(id, async () => { throw new Error('fail'); }));
    assert.equal(await lifecycle.withSessionLock(id, async () => 'ok'), 'ok');
    await assert.rejects(lifecycle.withSessionLock('../invalid', async () => {}), { status: 400 });
  });
});
