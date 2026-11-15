import test from 'node:test';
import assert from 'node:assert/strict';
import { bindYoutubeFullscreenOrientation } from '../src/utils/youtubeFullscreen.js';

const setup = (lock = async () => {}) => {
  const calls = [];
  const doc = new EventTarget();
  doc.defaultView = { screen: { orientation: {
    lock: (value) => { calls.push(value); return lock(); },
    unlock: () => calls.push('unlock'),
  } } };
  const iframe = { ownerDocument: doc };
  const cleanup = bindYoutubeFullscreenOrientation(iframe);
  const fullscreen = (element) => {
    doc.fullscreenElement = element;
    doc.dispatchEvent(new Event('fullscreenchange'));
  };
  return { calls, iframe, fullscreen, cleanup, doc };
};

test('locks only the YouTube iframe and unlocks on exit', async () => {
  const { calls, iframe, fullscreen, cleanup } = setup();
  fullscreen({});
  assert.deepEqual(calls, []);
  fullscreen(iframe);
  await Promise.resolve();
  assert.deepEqual(calls, ['landscape']);
  fullscreen(null);
  assert.deepEqual(calls, ['landscape', 'unlock']);
  cleanup();
  fullscreen(iframe);
  assert.deepEqual(calls, ['landscape', 'unlock']);
});

test('releases a pending orientation lock after unmount', async () => {
  let resolveLock;
  const { calls, iframe, fullscreen, cleanup } = setup(() => new Promise((resolve) => { resolveLock = resolve; }));
  fullscreen(iframe);
  cleanup();
  resolveLock();
  await Promise.resolve();
  assert.deepEqual(calls, ['landscape', 'unlock', 'unlock']);
});

test('unsupported or rejected orientation locking does not break fullscreen', async () => {
  const { iframe, fullscreen, cleanup } = setup(async () => { throw new Error('Unsupported'); });
  fullscreen(iframe);
  await Promise.resolve();
  fullscreen(null);
  cleanup();
  const doc = new EventTarget();
  const remove = bindYoutubeFullscreenOrientation({ ownerDocument: doc });
  remove();
});
