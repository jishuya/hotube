const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../src/db');
const push = require('../src/services/pushNotificationService');
const { sendManualMediaNotification: send } = require('../src/services/manualMediaNotificationService');

function setup(t, { role = 'admin', enabled = true, audience = ['dad-user', 'mom-user'], previous = null } = {}) {
  const calls = [];
  t.mock.method(db, 'query', async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('SELECT role, developer_mode')) return { rows: [{ role, developer_mode: enabled }] };
    if (sql.includes('INSERT INTO manual_media_notifications')) return { rows: previous ? [] : [{ id: params[0] }] };
    if (sql.includes('SELECT actor_id, groups, result')) return { rows: [previous] };
    if (sql.includes('SELECT id FROM users')) return { rows: audience.map((id) => ({ id })) };
    return { rows: [] };
  });
  const delivery = t.mock.method(push, 'sendToUserIds', async () => ({ sent: 2, failed: 0 }));
  return { calls, delivery };
}

test('manual send requires an admin with developer mode enabled', async (t) => {
  for (const options of [{ role: 'user' }, { role: 'sub-admin' }, { enabled: false }]) {
    const { calls, delivery } = setup(t, options);
    await assert.rejects(send({ actorId: 'actor', groups: ['dad'], requestId: randomUUID() }), { status: 403 });
    assert.equal(calls.length, 1);
    assert.equal(delivery.mock.callCount(), 0);
    t.mock.restoreAll();
  }
});

test('empty or unsupported groups and malformed request ids cannot trigger a send', async (t) => {
  const { delivery } = setup(t);
  for (const groups of [[], ['etc'], ['dad', 'unknown'], null]) {
    await assert.rejects(send({ actorId: 'actor', groups, requestId: randomUUID() }), { status: 400 });
  }
  await assert.rejects(send({ actorId: 'actor', groups: ['dad'], requestId: 'invalid' }), { status: 400 });
  assert.equal(delivery.mock.callCount(), 0);
});

test('one announcement goes to the selected audience, respects media preferences and links to the album', async (t) => {
  const { calls, delivery } = setup(t);
  const requestId = randomUUID();
  assert.deepEqual(await send({ actorId: 'actor', groups: ['mom', 'dad', 'dad'], requestId }), { recipients: 2, sent: 2, failed: 0 });
  const audienceQuery = calls.find(({ sql }) => sql.includes('SELECT id FROM users'));
  assert.deepEqual(audienceQuery.params, ['actor', ['dad', 'mom']]);
  assert.match(audienceQuery.sql, /id <> \$1/);
  assert.match(audienceQuery.sql, /role NOT IN/);
  assert.match(audienceQuery.sql, /'couple' = ANY/);
  const [ids, payload, preference] = delivery.mock.calls[0].arguments;
  assert.deepEqual(ids, ['dad-user', 'mom-user']);
  assert.equal(preference, 'media');
  assert.equal(payload.url, '/album');
  assert.equal(payload.title, '새로운 추억이 등록됐어요');
  assert.equal(calls.filter(({ sql }) => sql.includes('INSERT INTO user_notifications')).length, 1);
  assert.ok(!calls.some(({ sql }) => sql.includes('UPDATE media')));
});

test('couple selection is passed separately from family categories', async (t) => {
  const { calls } = setup(t, { audience: ['spouse'] });
  const result = await send({ actorId: 'actor', groups: ['couple'], requestId: randomUUID() });
  assert.equal(result.recipients, 1);
  assert.deepEqual(calls.find(({ sql }) => sql.includes('SELECT id FROM users')).params[1], ['couple']);
});

test('a repeated request returns the saved result without sending again', async (t) => {
  const result = { sent: 1, failed: 0, recipients: 1 };
  const { delivery, calls } = setup(t, { previous: { actor_id: 'actor', groups: ['dad'], result } });
  assert.deepEqual(await send({ actorId: 'actor', groups: ['dad'], requestId: randomUUID() }), { ...result, alreadySent: true });
  assert.equal(delivery.mock.callCount(), 0);
  assert.ok(!calls.some(({ sql }) => sql.includes('INSERT INTO user_notifications')));
});

test('an in-flight or mismatched request is not sent again', async (t) => {
  for (const previous of [
    { actor_id: 'actor', groups: ['dad'], result: null },
    { actor_id: 'someone-else', groups: ['dad'], result: {} },
    { actor_id: 'actor', groups: ['mom'], result: {} },
  ]) {
    const { delivery } = setup(t, { previous });
    await assert.rejects(send({ actorId: 'actor', groups: ['dad'], requestId: randomUUID() }), { status: 409 });
    assert.equal(delivery.mock.callCount(), 0);
    t.mock.restoreAll();
  }
});

test('no matching recipients creates no internal notifications', async (t) => {
  const { calls, delivery } = setup(t, { audience: [] });
  delivery.mock.mockImplementation(async () => ({ sent: 0, failed: 0 }));
  assert.deepEqual(await send({ actorId: 'actor', groups: ['couple'], requestId: randomUUID() }), { recipients: 0, sent: 0, failed: 0 });
  assert.ok(!calls.some(({ sql }) => sql.includes('INSERT INTO user_notifications')));
});
