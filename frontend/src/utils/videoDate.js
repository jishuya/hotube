// QuickTime/ISO BMFF atoms: skip media payloads and read only date metadata.
// https://developer.apple.com/documentation/quicktime-file-format/movie_header_atom
const QUICKTIME_EPOCH = Date.UTC(1904, 0, 1);
const decoder = new TextDecoder();
const localDateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const validDate = (date) => Number.isFinite(date.getTime())
  && date.getTime() >= Date.UTC(1970, 0, 2)
  && date.getTime() <= Date.now() + 86400000;

function taggedDate(value) {
  const text = value.replace(/\0/g, '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.exec(text);
  if (!match || !validDate(new Date(text))) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null;
  // Keep the calendar date in the recording's explicit timezone.
  return `${year}-${month}-${day}`;
}

export async function getVideoDate(file) {
  let remainingAtoms = 10000;
  let remainingBytes = 1024 * 1024;
  let headerDate = null;
  let captureDate = null;
  const read = async (start, length) => {
    if (length < 0 || start + length > file.size || length > remainingBytes) throw new Error('Invalid metadata size');
    remainingBytes -= length;
    return new DataView(await file.slice(start, start + length).arrayBuffer());
  };
  const string = (view, start = 0) => decoder.decode(new Uint8Array(view.buffer, start));
  const atoms = async (start, end) => {
    const result = [];
    for (let offset = start; offset + 8 <= end;) {
      if (--remainingAtoms < 0) throw new Error('Too many atoms');
      const head = await read(offset, 8);
      const type = string(head, 4);
      let size = head.getUint32(0);
      let headerSize = 8;
      if (size === 1) {
        if (offset + 16 > end) throw new Error('Truncated atom');
        size = Number((await read(offset + 8, 8)).getBigUint64(0));
        headerSize = 16;
      } else if (size === 0) size = end - offset;
      if (!Number.isSafeInteger(size) || size < headerSize || offset + size > end) throw new Error('Invalid atom');
      result.push({ type, id: head.getUint32(4), start: offset + headerSize, end: offset + size });
      offset += size;
    }
    return result;
  };
  const metadata = async (atom) => {
    if (atom.end - atom.start < 8) return;
    // QuickTime meta has no version prefix; ISO meta has four version/flag bytes.
    const first = await read(atom.start, 8);
    const start = string(first, 4) === 'hdlr' ? atom.start : atom.start + 4;
    const children = await atoms(start, atom.end);
    const keys = children.find((child) => child.type === 'keys');
    const list = children.find((child) => child.type === 'ilst');
    if (!keys || !list || keys.end - keys.start < 8) return;
    const view = await read(keys.start, keys.end - keys.start);
    const count = view.getUint32(4);
    let dateIndex = -1;
    let offset = 8;
    for (let index = 1; index <= count; index++) {
      if (offset + 8 > view.byteLength) return;
      const size = view.getUint32(offset);
      if (size < 8 || offset + size > view.byteLength) return;
      const key = decoder.decode(new Uint8Array(view.buffer, offset + 8, size - 8));
      if (key === 'com.apple.quicktime.creationdate') dateIndex = index;
      offset += size;
    }
    if (dateIndex < 0) return;
    for (const entry of await atoms(list.start, list.end)) {
      if (entry.id !== dateIndex) continue;
      for (const data of await atoms(entry.start, entry.end)) {
        if (data.type !== 'data' || data.end - data.start < 8 || data.end - data.start > 1024) continue;
        const value = await read(data.start, data.end - data.start);
        if ((value.getUint32(0) & 0xffffff) === 1) captureDate ||= taggedDate(string(value, 8));
      }
    }
  };
  const walk = async (start, end, depth = 0) => {
    if (depth > 4) return;
    for (const atom of await atoms(start, end)) {
      if (atom.type === 'moov' || atom.type === 'udta') await walk(atom.start, atom.end, depth + 1);
      else if (atom.type === 'meta') await metadata(atom);
      else if (atom.type === 'mvhd' && atom.end - atom.start >= 8) {
        const view = await read(atom.start, Math.min(12, atom.end - atom.start));
        const version = view.getUint8(0);
        const seconds = version === 0 ? view.getUint32(4)
          : version === 1 && view.byteLength >= 12 ? Number(view.getBigUint64(4)) : 0;
        const date = new Date(QUICKTIME_EPOCH + seconds * 1000);
        if (seconds > 0 && validDate(date)) headerDate ||= localDateKey(date);
      }
    }
  };
  try {
    await walk(0, file.size);
    return captureDate || headerDate;
  } catch {
    // Unsupported, malformed or excessive metadata must not block selection.
    return null;
  }
}
