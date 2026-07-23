const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const { createBrowserCompatibleVideo, createVideoThumbnail } = require('../src/videoThumbnail');

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'ignore' });
  child.on('error', reject);
  child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
});

test('영상에서 JPEG 썸네일을 생성한다', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-thumbnail-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const videoPath = path.join(directory, 'sample.mp4');
  const thumbnailPath = path.join(directory, 'thumbnail.jpg');

  await run(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'color=c=orange:s=160x120:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', videoPath,
  ]);
  await createVideoThumbnail(videoPath, thumbnailPath);

  const thumbnail = await fs.readFile(thumbnailPath);
  assert.equal(thumbnail[0], 0xff);
  assert.equal(thumbnail[1], 0xd8);
  assert.ok(thumbnail.length > 100);
});

test('브라우저용 MP4 영상을 생성한다', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-browser-video-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, 'input.mp4');
  const outputPath = path.join(directory, 'output.mp4');

  await run(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'color=c=orange:s=160x120:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', inputPath,
  ]);
  await createBrowserCompatibleVideo(inputPath, outputPath);

  const output = await fs.readFile(outputPath);
  assert.equal(output.subarray(4, 8).toString(), 'ftyp');
  assert.ok(output.length > 1000);
});
