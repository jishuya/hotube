const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { getDeveloperMode, setDeveloperMode, isDeveloperMode } = require('../src/services/developerModeService');
const { notifyNewMedia, notifyNewComment, notifySupportCreated, notifySupportStatus } = require('../src/services/pushNotificationService');

test('only a current admin can enable developer mode; invalid values are rejected', async (t) => {
  const query = t.mock.method(db, 'query', async () => ({ rows: [] }));
  await assert.rejects(setDeveloperMode('user', true), { status: 403 });
  assert.match(query.mock.calls[0].arguments[0], /role = 'admin'/);
  await assert.rejects(setDeveloperMode('admin', 'true'), { status: 400 });
  assert.equal(query.mock.callCount(), 1);
  await assert.rejects(getDeveloperMode('missing'), { status: 403 });
});

test('admin setting can be enabled and disabled and is read from the server', async (t) => {
  let enabled = false;
  t.mock.method(db, 'query', async (sql, args) => {
    if (sql.includes('UPDATE')) enabled = args[1];
    return { rows: [{ role: 'admin', developer_mode: enabled }] };
  });
  assert.deepEqual(await getDeveloperMode('admin'), { enabled: false });
  assert.deepEqual(await setDeveloperMode('admin', true), { enabled: true });
  assert.equal(await isDeveloperMode('admin'), true);
  assert.deepEqual(await setDeveloperMode('admin', false), { enabled: false });
  assert.equal(await isDeveloperMode('admin'), false);
});

test('ordinary users and demoted admins cannot suppress notifications', async (t) => {
  t.mock.method(db, 'query', async () => ({ rows: [{ role: 'user', developer_mode: true }] }));
  assert.equal(await isDeveloperMode('user'), false);
  await assert.rejects(getDeveloperMode('user'), { status: 403 });
});

test('suppressed uploads never query recipients or send notifications, even after mode is turned off', async (t) => {
  t.mock.method(db, 'query', async () => { throw new Error('Must not query notification recipients'); });
  const result = await notifyNewMedia({ media: { notifications_suppressed: true }, uploader: { id: 'admin' } });
  assert.equal(result.suppressed, true);
});

test('developer comments and support operations create no internal or push notifications', async (t) => {
  const query = t.mock.method(db, 'query', async (sql) => {
    assert.match(sql, /^SELECT role, developer_mode/);
    return { rows: [{ role: 'admin', developer_mode: true }] };
  });
  for (const result of [
    await notifyNewComment({ commenter: { id: 'admin' }, mediaId: 'media', content: 'test' }),
    await notifySupportCreated({ user: { id: 'admin' }, request: { id: 'request' } }),
    await notifySupportStatus({ actorId: 'admin', requestId: 'request', status: 'resolved' }),
  ]) assert.equal(result.suppressed, true);
  assert.equal(query.mock.callCount(), 3);
});

test('normal uploads and comments continue through notification recipient lookup', async (t) => {
  const queries = [];
  t.mock.method(db, 'query', async (sql) => {
    queries.push(sql);
    if (sql.includes('SELECT role, developer_mode')) return { rows: [{ role: 'user', developer_mode: false }] };
    return { rows: [] };
  });
  assert.deepEqual(await notifyNewMedia({ media: { id: 'media', notifications_suppressed: false }, uploader: { id: 'user' } }), { sent: 0, failed: 0 });
  assert.deepEqual(await notifyNewComment({ commenter: { id: 'user' }, mediaId: 'media', content: 'test' }), { sent: 0, failed: 0 });
  assert.ok(queries.some((sql) => sql.includes('FROM users')));
  assert.ok(queries.some((sql) => sql.includes('SELECT DISTINCT u.id')));
});

test('settings API requires authentication and uses token identity rather than a supplied user id', async (t) => {
  const express = require('express');
  const { createAccessToken } = require('../src/authToken');
  const originalSecret = process.env.AUTH_TOKEN_SECRET;
  process.env.AUTH_TOKEN_SECRET = 'developer-mode-test-only';
  t.after(() => { if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET; else process.env.AUTH_TOKEN_SECRET = originalSecret; });
  const query = t.mock.method(db, 'query', async (sql, args) => ({ rows: args[0] === 'admin' ? [{ role: 'admin', developer_mode: true }] : [] }));
  const app = express();
  app.use(express.json());
  app.use(require('../src/routes/pushNotifications'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/push/developer-mode`;
  assert.equal((await fetch(url)).status, 401);
  const userToken = createAccessToken({ id: 'user', role: 'user' });
  const denied = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true, userId: 'admin' }) });
  assert.equal(denied.status, 403);
  assert.equal(query.mock.calls[0].arguments[1][0], 'user');
  const token = createAccessToken({ id: 'admin', role: 'admin' });
  const allowed = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { enabled: true });
});
