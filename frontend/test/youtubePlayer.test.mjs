import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { bindYoutubeFullscreenOrientation } from '../src/utils/youtubeFullscreen.js';

const page = await readFile(new URL('../src/pages/MediaViewerPage.jsx', import.meta.url), 'utf8');
const component = page.slice(page.indexOf('const YoutubeMediaPlayer ='), page.indexOf('const MediaVideoPlayer ='));
const { code } = await transform(`${component}\n globalThis.Player = YoutubeMediaPlayer;`, { loader: 'jsx' });

test('Long player opens and closes without iframe or matchMedia errors', () => {
  const effects = [];
  const slots = [];
  let index = 0;
  const listeners = new Map();
  const window = { innerWidth: 390, innerHeight: 844,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const context = { window, bindYoutubeFullscreenOrientation, Icon: 'icon', extractVideoId: () => 'example',
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    useRef: (value) => slots[index++] ??= { current: value },
    useState: (initial) => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;
      return [slots[slot], (value) => { slots[slot] = typeof value === 'function' ? value(slots[slot]) : value; }];
    },
    useEffect: (effect) => effects.push(effect),
  };
  vm.runInNewContext(code, context);
  const render = (fullscreen) => {
    index = 0;
    effects.length = 0;
    const tree = context.Player({ src: 'example', title: 'Test', isShort: false, isFullscreen: fullscreen, onFullscreenChange() {} });
    slots[0].current = null;
    const iframe = tree.props.children.find((child) => child?.type === 'iframe');
    if (iframe) iframe.props.ref.current = { ownerDocument: new EventTarget() };
    for (const effect of effects) effect();
    return { tree, iframe };
  };
  assert.equal(render(false).tree.type, 'button');
  assert.equal(render(true).iframe.props.style.transform, 'rotate(90deg)');
  assert.equal(render(false).tree.type, 'button');
  window.innerWidth = 844;
  window.innerHeight = 390;
  listeners.get('resize')();
  assert.equal(render(true).iframe.props.style.transform, 'rotate(0deg)');
});
