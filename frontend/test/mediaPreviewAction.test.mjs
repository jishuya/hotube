import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/components/common/MediaPreviewAction.jsx', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' });

// Exercise the real component handlers with controlled requests and hook state.
function setup({ kind = 'like', initiallyActive = false, loggedIn = true } = {}) {
  const slots = [];
  let index = 0;
  let liked = initiallyActive;
  let resolveRequest;
  let rejectRequest;
  const calls = [];
  const request = (...args) => {
    calls.push(args);
    return new Promise((resolve, reject) => { resolveRequest = resolve; rejectRequest = reject; });
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: {
      useState(initial) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = initial;
        return [slots[slot], (value) => { slots[slot] = value; }];
      },
      useRef(initial) {
        const slot = index++;
        return slots[slot] ??= { current: initial };
      },
      useEffect(effect) { effect(); },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    '@iconify/react': { Icon: 'icon' },
    '../../contexts/AuthContext': { useAuth: () => ({
      user: loggedIn ? { id: 'viewer' } : null,
      isLiked: () => liked,
      toggleLikeLocal: () => { liked = !liked; },
    }) },
    '../../services/authApi': { toggleLike: request },
    '../../services/videoApi': { toggleFavorite: request },
  };
  const context = { module: { exports: {} }, require: (name) => {
    assert.ok(modules[name], `unexpected dependency ${name}`);
    return modules[name];
  } };
  vm.runInNewContext(code, context);
  const render = () => {
    index = 0;
    return context.module.exports.default({ mediaId: 'media', kind, initiallyActive }).props.children;
  };
  const event = { prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  return { render, calls, event, resolve: (value) => resolveRequest(value), reject: () => rejectRequest(new Error('offline')) };
}

for (const kind of ['like', 'favorite']) {
  test(`${kind}: select and cancel without navigation or duplicate requests`, async () => {
    const app = setup({ kind });
    const [button] = app.render();
    const pending = button.props.onClick(app.event);
    assert.equal(app.event.prevented, true);
    assert.equal(app.event.stopped, true);
    assert.equal(app.render()[0].props['aria-pressed'], true);
    assert.equal(app.render()[0].props.disabled, true);
    await button.props.onClick(app.event);
    assert.equal(app.calls.length, 1);
    assert.deepEqual(app.calls[0], ['viewer', 'media']);
    app.resolve(kind === 'like' ? { liked: true } : { favorited: true });
    await pending;
    assert.equal(app.render()[0].props['aria-pressed'], true);
    const cancel = app.render()[0].props.onClick(app.event);
    app.resolve(kind === 'like' ? { liked: false } : { favorited: false });
    await cancel;
    assert.equal(app.render()[0].props['aria-pressed'], false);
    assert.equal(app.render()[0].props.disabled, false);
  });

  test(`${kind}: failed cancellation restores selected state and allows retry`, async () => {
    const app = setup({ kind, initiallyActive: true });
    const pending = app.render()[0].props.onClick(app.event);
    assert.equal(app.render()[0].props['aria-pressed'], false);
    app.reject();
    await pending;
    const [button, error] = app.render();
    assert.equal(button.props['aria-pressed'], true);
    assert.equal(button.props.disabled, false);
    assert.equal(error.props.role, 'alert');
  });
}

test('signed-out previews cannot send a mutation', async () => {
  const app = setup({ loggedIn: false });
  const [button] = app.render();
  assert.equal(button.props.disabled, true);
  await button.props.onClick(app.event);
  assert.equal(app.calls.length, 0);
});
