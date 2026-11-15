import test from 'node:test';
import assert from 'node:assert/strict';
import { createUploadManager, bindUploadRecovery } from '../src/services/uploadManager.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const record = (id, userId = 'user') => ({ id, userId, file: new File(['content'], `${id}.mp4`), options: { uploadedBy: userId, contentHash: id } });
const setup = (overrides = {}) => {
  const stored = new Map();
  const calls = [];
  const manager = createUploadManager({
    list: async (userId) => [...stored.values()].filter((item) => item.userId === userId).map(({ id, file }) => ({ id, size: file.size })),
    get: async (id) => stored.get(id),
    save: async (item) => { stored.set(item.id, item); calls.push(`save:${item.id}`); },
    remove: async (id) => { stored.delete(id); },
    upload: async (file) => { calls.push(`upload:${file.name}`); return { id: file.name }; },
    ...overrides,
  });
  manager.setUser('user');
  return { manager, stored, calls };
};

test('persists the complete batch before transferring and survives page unsubscribe', async () => {
  const { manager, calls, stored } = setup();
  const unsubscribe = manager.subscribe(() => {});
  const task = manager.start([record('a'), record('b'), record('c')]);
  unsubscribe(); // route unmount detaches UI without cancelling the transfer
  const result = await task;
  assert.equal(result.created.length, 3);
  assert.deepEqual(calls, ['save:a', 'save:b', 'save:c', 'upload:a.mp4', 'upload:b.mp4', 'upload:c.mp4']);
  assert.equal(stored.size, 0);
  assert.equal(manager.getSnapshot().pending, 0);
});

test('focus recovery and online recovery share one in-flight transfer', async () => {
  let finish;
  let count = 0;
  const { manager } = setup({ upload: () => { count++; return new Promise((resolve) => { finish = resolve; }); } });
  const task = manager.start([record('a')]);
  await tick();
  const resumed = manager.resume();
  assert.equal(resumed, task);
  assert.equal(await manager.start([record('b')]), null);
  assert.equal(count, 1);
  finish({ id: 'a' });
  await task;
  assert.equal(count, 1);
});

test('manual stop remains stopped on focus and resumes only after explicit retry', async () => {
  let attempts = 0;
  const { manager } = setup({ upload: async (_file, _options, { signal }) => {
    attempts++;
    if (attempts > 1) return { id: 'a' };
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('stop', 'AbortError')), { once: true }));
  } });
  const task = manager.start([record('a')]);
  await tick();
  manager.pause();
  await task;
  assert.equal(manager.getSnapshot().paused, true);
  await manager.resume();
  assert.equal(attempts, 1);
  await manager.resume({ manual: true });
  assert.equal(attempts, 2);
  assert.equal(manager.getSnapshot().pending, 0);
});

test('a foreground event during a failing request schedules recovery after it settles', async () => {
  let fail;
  let attempts = 0;
  const { manager } = setup({ upload: async () => {
    if (++attempts === 1) return new Promise((_resolve, reject) => { fail = reject; });
    return { id: 'a' };
  } });
  const task = manager.start([record('a')]);
  await tick();
  void manager.resume();
  fail(new TypeError('networkerror'));
  await task;
  await tick();
  assert.equal(attempts, 2);
  assert.equal(manager.getSnapshot().pending, 0);
});

test('storage failure retains every selected file in memory and reports recoverability', async () => {
  let failUpload = true;
  const uploaded = [];
  const { manager } = setup({
    save: async () => { throw new Error('QuotaExceeded'); },
    upload: async (file) => {
      if (failUpload) throw new TypeError('networkerror');
      uploaded.push(file.name); return { id: file.name };
    },
  });
  await manager.start([record('a'), record('b'), record('c')]);
  assert.equal(manager.getSnapshot().pending, 3);
  assert.match(manager.getSnapshot().notice, /3개 중 0개/);
  failUpload = false;
  await manager.resume();
  assert.deepEqual(uploaded, ['a.mp4', 'b.mp4', 'c.mp4']);
});

test('restores persisted queue for the current user and removes invalid records', async () => {
  const { manager, stored } = setup({ upload: async (file) => {
    if (file.name === 'bad.mp4') throw Object.assign(new Error('invalid'), { status: 400 });
    return { id: file.name };
  } });
  stored.set('bad', record('bad'));
  stored.set('good', record('good'));
  stored.set('other', record('other', 'other'));
  const result = await manager.resume();
  assert.equal(result.created.length, 1);
  assert.equal(manager.getSnapshot().completed, 1);
  assert.equal(stored.size, 1);
  assert.ok(stored.has('other'));
});

test('signing out aborts the old transfer and cannot expose it to the next user', async () => {
  let aborted = false;
  const { manager } = setup({ upload: (_file, _options, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('stop', 'AbortError')); }, { once: true });
  }) });
  const task = manager.start([record('a')]);
  await tick();
  manager.setUser('other');
  await task;
  await tick();
  assert.equal(aborted, true);
  assert.equal(manager.getSnapshot().userId, 'other');
  assert.equal(manager.getSnapshot().pending, 0);
});

test('recovery listens to visible pageshow, visibility and online, then removes listeners', () => {
  const win = new EventTarget();
  win.navigator = { onLine: true };
  const doc = new EventTarget();
  doc.visibilityState = 'hidden';
  let attempts = 0;
  const remove = bindUploadRecovery({ resume: () => { attempts++; } }, win, doc);
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(attempts, 0);
  doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange'));
  win.dispatchEvent(new Event('pageshow'));
  win.dispatchEvent(new Event('online'));
  assert.equal(attempts, 3);
  remove();
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(attempts, 3);
});
