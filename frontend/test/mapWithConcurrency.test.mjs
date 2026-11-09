import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../src/utils/mapWithConcurrency.js';

test('두 작업으로 제한하며 완료 순서와 무관하게 입력 순서를 유지한다', async () => {
  let active = 0; let maximum = 0;
  const results = await mapWithConcurrency([3, 1, 2, 0], 2, async (value) => {
    maximum = Math.max(maximum, ++active);
    await new Promise((resolve) => setTimeout(resolve, value));
    active--;
    return value * 2;
  });
  assert.deepEqual(results, [6, 2, 4, 0]);
  assert.equal(maximum, 2);
  assert.equal(active, 0);
});

test('취소 후 새 작업은 시작하지 않고 진행 중 작업 종료까지 기다린다', async () => {
  const controller = new AbortController(); let started = 0; let active = 0;
  await assert.rejects(mapWithConcurrency([1, 2, 3, 4], 2, async () => {
    started++; active++;
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort(); active--;
  }, controller.signal), { name: 'AbortError' });
  assert.equal(started, 2);
  assert.equal(active, 0);
});
