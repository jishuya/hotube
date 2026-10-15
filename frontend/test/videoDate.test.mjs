import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVideoDate } from '../src/utils/videoDate.js';

const u32 = (value) => { const b = Buffer.alloc(4); b.writeUInt32BE(value); return b; };
const atom = (type, ...parts) => {
  const data = Buffer.concat(parts);
  return Buffer.concat([u32(data.length + 8), typeof type === 'number' ? u32(type) : Buffer.from(type), data]);
};
const epoch = Date.UTC(1904, 0, 1);
const movie = (date, version = 0) => {
  const seconds = date ? (new Date(date).getTime() - epoch) / 1000 : 0;
  const data = Buffer.alloc(version === 1 ? 12 : 8);
  data[0] = version;
  if (version === 1) data.writeBigUInt64BE(BigInt(seconds), 4);
  else data.writeUInt32BE(seconds, 4);
  return atom('mvhd', data);
};
const metadata = (date, iso = false) => atom('meta',
  ...(iso ? [u32(0)] : []),
  atom('hdlr', Buffer.alloc(24)),
  atom('keys', u32(0), u32(1), atom('mdta', Buffer.from('com.apple.quicktime.creationdate'))),
  atom('ilst', atom(1, atom('data', u32(1), u32(0), Buffer.from(date)))),
);
const blob = (...parts) => new Blob(parts);
const localKey = (value) => {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

test('MP4 creation time, including 64-bit headers and local day rollover', async () => {
  for (const version of [0, 1]) {
    const date = '2024-05-01T23:30:00Z';
    assert.equal(await getVideoDate(blob(atom('moov', movie(date, version)))), localKey(date));
  }
});

test('iPhone recording date takes priority and preserves the recording timezone', async () => {
  for (const iso of [false, true]) {
    const file = blob(atom('moov', movie('2025-01-01T00:00:00Z'),
      atom('udta', metadata('2024-05-01T23:30:00-0700', iso))));
    assert.equal(await getVideoDate(file), '2024-05-01');
  }
});

test('missing, zero, future and malformed metadata require user confirmation', async () => {
  for (const file of [blob(), blob('webm data'), blob(atom('moov', movie(null))),
    blob(atom('moov', movie('2099-01-01T00:00:00Z', 1))),
    blob(u32(100), Buffer.from('moov')), blob(u32(4), Buffer.from('moov')),
    blob(atom('moov', metadata('2024-02-31T10:00:00Z')))]) {
    assert.equal(await getVideoDate(file), null);
  }
});

test('media payload is skipped even when moov follows it', async () => {
  const input = blob(atom('mdat', Buffer.alloc(2 * 1024 * 1024)), atom('moov', movie('2024-06-01T12:00:00Z')));
  let bytesRead = 0;
  const file = { size: input.size, slice(start, end) { bytesRead += end - start; return input.slice(start, end); } };
  assert.equal(await getVideoDate(file), localKey('2024-06-01T12:00:00Z'));
  assert.ok(bytesRead < 1024);
});

test('extended-size and zero-size atoms are supported', async () => {
  const payload = movie('2024-06-01T12:00:00Z');
  const size = Buffer.alloc(8);
  size.writeBigUInt64BE(BigInt(16 + payload.length));
  for (const header of [Buffer.concat([u32(1), Buffer.from('moov'), size]), Buffer.concat([u32(0), Buffer.from('moov')])]) {
    assert.equal(await getVideoDate(blob(header, payload)), localKey('2024-06-01T12:00:00Z'));
  }
});
