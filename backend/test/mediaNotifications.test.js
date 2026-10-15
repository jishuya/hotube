const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { notifyNewMedia } = require('../src/services/pushNotificationService');

test('N requires a received upload notification and excludes own and watched media', async () => {
  const { isNewMedia } = await import('../../frontend/src/utils/mediaNotifications.js');
  const media = { id: 'photo', uploadedBy: 'other' };
  const user = { id: 'viewer', notifiedMediaIds: [], watchedVideos: [] };
  assert.equal(isNewMedia(media, null), false);
  assert.equal(isNewMedia(media, user), false); // First login: no notifications.
  const notified = { ...user, notifiedMediaIds: ['photo'] };
  assert.equal(isNewMedia(media, notified), true);
  assert.equal(isNewMedia({ ...media, uploadedBy: 'viewer' }, notified), false);
  assert.equal(isNewMedia(media, { ...notified, watchedVideos: ['photo'] }), false);
  assert.equal(isNewMedia({ ...media, id: 'old-photo' }, notified), false);
});

test('every item in an already announced batch retains its notification record', async (t) => {
  const recorded = [];
  let claimed = false;
  t.mock.method(db, 'query', async (sql, params) => {
    if (sql.includes('INSERT INTO user_media_notifications')) {
      recorded.push(params);
      assert.match(sql, /m.created_at > u.first_login_at/);
      assert.match(sql, /COALESCE\(unp.media_enabled, TRUE\)/);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO media_notification_batches')) {
      const rows = claimed ? [] : [{ user_id: 'viewer' }];
      claimed = true;
      return { rows };
    }
    if (sql.includes('FROM users')) return { rows: [{ id: 'viewer' }] };
    if (sql.includes('FROM push_subscriptions')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  });
  for (const id of ['first', 'second']) {
    await notifyNewMedia({ media: { id }, uploader: { id: 'uploader' }, uploadBatchId: 'batch' });
  }
  assert.deepEqual(recorded, [[['viewer'], 'first'], [['viewer'], 'second']]);
});

test('login only initializes the baseline after password verification and retains it on later logins', async (t) => {
  const express = require('express');
  const bcrypt = require('bcryptjs');
  const password = await bcrypt.hash('secret!', 4);
  let firstLogin = null;
  let loginWrites = 0;
  t.mock.method(db, 'query', async (sql) => {
    if (sql.includes('UPDATE users SET first_login_at')) {
      assert.match(sql, /COALESCE\(first_login_at, CURRENT_TIMESTAMP\)/);
      loginWrites++;
      firstLogin ||= new Date('2026-10-15T01:00:00Z');
      return { rows: [{ first_login_at: firstLogin }] };
    }
    return { rows: [{ id: 'viewer', password, first_login_at: firstLogin, notified_media_ids: [] }] };
  });
  const previousSecret = process.env.AUTH_TOKEN_SECRET;
  process.env.AUTH_TOKEN_SECRET = 'media-baseline-test';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
    else process.env.AUTH_TOKEN_SECRET = previousSecret;
  });
  const app = express();
  app.use(express.json());
  app.use(require('../src/routes/auth'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const login = (value) => fetch(`http://127.0.0.1:${server.address().port}/loginUser`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'viewer', password: value }),
  });
  assert.equal((await login('wrong')).status, 401);
  assert.equal(loginWrites, 0);
  const first = await (await login('secret!')).json();
  const second = await (await login('secret!')).json();
  assert.equal(first.firstLoginAt, '2026-10-15T01:00:00.000Z');
  assert.equal(second.firstLoginAt, first.firstLoginAt);
  assert.deepEqual(first.notifiedMediaIds, []);
});
