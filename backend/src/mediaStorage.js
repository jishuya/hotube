const fs = require('fs');
const os = require('os');
const path = require('path');

const mediaDirectory = process.env.MEDIA_UPLOAD_DIR
  ? path.resolve(process.env.MEDIA_UPLOAD_DIR.replace(/^~(?=$|\/)/, os.homedir()))
  : path.join(os.homedir(), 'workspace/lab/hotube_data/media');

const ensureMediaDirectory = () => {
  fs.mkdirSync(mediaDirectory, { recursive: true });
};

const getDateDirectory = (uploadedAt) => {
  const match = String(uploadedAt || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('미디어 날짜는 YYYY-MM-DD 형식이어야 합니다');
  const date = new Date(`${uploadedAt}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== uploadedAt) {
    throw new Error('올바른 미디어 날짜가 필요합니다');
  }
  return path.join(match[1], match[2], match[3]);
};

const ensureMediaDateDirectory = (uploadedAt) => {
  const relativeDirectory = getDateDirectory(uploadedAt);
  const absoluteDirectory = path.join(mediaDirectory, relativeDirectory);
  fs.mkdirSync(absoluteDirectory, { recursive: true });
  return { absoluteDirectory, relativeDirectory };
};

const toStoredMediaPath = (relativeDirectory, filename) => path
  .join(relativeDirectory, path.basename(filename))
  .split(path.sep)
  .join('/');

const resolveMediaPath = (storedPath) => {
  const normalized = String(storedPath || '').replace(/\\/g, '/');
  if (!normalized || path.posix.isAbsolute(normalized)) throw new Error('잘못된 미디어 파일 경로입니다');
  const resolved = path.resolve(mediaDirectory, ...normalized.split('/'));
  const relative = path.relative(mediaDirectory, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('잘못된 미디어 파일 경로입니다');
  }
  return resolved;
};

module.exports = {
  ensureMediaDateDirectory,
  ensureMediaDirectory,
  mediaDirectory,
  resolveMediaPath,
  toStoredMediaPath,
};
