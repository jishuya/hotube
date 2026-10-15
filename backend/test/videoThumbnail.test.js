const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const {
  validateVideoDuration,
  createBrowserCompatibleVideo,
  createImagePreview,
  createImageThumbnail,
  createVideoThumbnail,
  isBrowserCompatibleVideo,
  isPlaybackOptimizedVideo,
} = require('../src/videoThumbnail');

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

test('사진에서 WebP 썸네일을 생성한다', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-image-thumbnail-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const imagePath = path.join(directory, 'sample.jpg');
  const thumbnailPath = path.join(directory, 'thumbnail.webp');

  await run(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'color=c=orange:s=1200x900', '-frames:v', '1', imagePath,
  ]);
  await createImageThumbnail(imagePath, thumbnailPath);

  const thumbnail = await fs.readFile(thumbnailPath);
  assert.equal(thumbnail.subarray(0, 4).toString(), 'RIFF');
  assert.equal(thumbnail.subarray(8, 12).toString(), 'WEBP');
  assert.ok(thumbnail.length > 100);
});

test('사진에서 상세 화면용 WebP 이미지를 생성한다', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-image-preview-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const imagePath = path.join(directory, 'sample.jpg');
  const previewPath = path.join(directory, 'preview.webp');

  await run(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'color=c=orange:s=2400x1600', '-frames:v', '1', imagePath,
  ]);
  await createImagePreview(imagePath, previewPath);

  const preview = await fs.readFile(previewPath);
  assert.equal(preview.subarray(0, 4).toString(), 'RIFF');
  assert.equal(preview.subarray(8, 12).toString(), 'WEBP');
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

test('H.264 MP4 영상은 브라우저 호환 영상으로 판별한다', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-compatible-video-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const videoPath = path.join(directory, 'sample.mp4');

  await run(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', 'color=c=orange:s=160x120:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', videoPath,
  ]);

  assert.equal(await isBrowserCompatibleVideo(videoPath), true);
  assert.equal(await isPlaybackOptimizedVideo(videoPath), true);
});

for (const seconds of [89, 90, 90.1]) {
  test(`영상 업로드 길이 경계 검사: ${seconds}초`, async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-duration-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const videoPath = path.join(directory, 'sample.mp4');
    await run(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
      '-i', `color=c=orange:s=16x16:r=10:d=${seconds}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', videoPath,
    ]);
    if (seconds <= 90) {
      assert.equal(await validateVideoDuration(videoPath), seconds);
    } else {
      await assert.rejects(validateVideoDuration(videoPath), { status: 400, code: 'VIDEO_TOO_LONG' });
    }
  });
}

test('읽을 수 없는 영상은 길이 검증에서 거절한다', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'hotube-invalid-video-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const videoPath = path.join(directory, 'invalid.mp4');
  await fs.writeFile(videoPath, 'invalid video');
  await assert.rejects(validateVideoDuration(videoPath), { status: 400, code: 'INVALID_VIDEO_DURATION' });
});
