const { spawn } = require('child_process');

const ffmpegExecutable = process.env.FFMPEG_PATH || 'ffmpeg';

/**
 * 영상 초반 프레임들 가운데 대표 프레임을 골라 앨범용 JPEG 썸네일을 생성한다.
 * FFmpeg는 서버에 설치되어 있어야 하며, 필요하면 FFMPEG_PATH로 경로를 지정할 수 있다.
 */
const createVideoThumbnail = (inputPath, outputPath) => new Promise((resolve, reject) => {
  const ffmpeg = spawn(ffmpegExecutable, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', "thumbnail=100,scale='min(640,iw)':-2",
    '-q:v', '3',
    outputPath,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let errorOutput = '';
  ffmpeg.stderr.setEncoding('utf8');
  ffmpeg.stderr.on('data', (chunk) => {
    // 오류 응답이 지나치게 커지지 않도록 마지막 8KB만 보관한다.
    errorOutput = `${errorOutput}${chunk}`.slice(-8192);
  });

  ffmpeg.on('error', (error) => {
    reject(new Error(`FFmpeg를 실행할 수 없습니다: ${error.message}`));
  });
  ffmpeg.on('close', (code) => {
    if (code === 0) return resolve();
    return reject(new Error(`영상 썸네일 생성 실패 (FFmpeg ${code}): ${errorOutput.trim()}`));
  });
});

/** 사진 원본을 목록용 640px WebP 썸네일로 변환한다. */
const createImageThumbnail = (inputPath, outputPath) => new Promise((resolve, reject) => {
  const ffmpeg = spawn(ffmpegExecutable, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', "scale='min(640,iw)':-2",
    '-c:v', 'libwebp',
    '-quality', '78',
    '-compression_level', '4',
    outputPath,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let errorOutput = '';
  ffmpeg.stderr.setEncoding('utf8');
  ffmpeg.stderr.on('data', (chunk) => {
    errorOutput = `${errorOutput}${chunk}`.slice(-8192);
  });
  ffmpeg.on('error', (error) => reject(new Error(`FFmpeg를 실행할 수 없습니다: ${error.message}`)));
  ffmpeg.on('close', (code) => {
    if (code === 0) return resolve();
    return reject(new Error(`사진 썸네일 생성 실패 (FFmpeg ${code}): ${errorOutput.trim()}`));
  });
});

/**
 * HEVC 등 브라우저 호환성이 낮은 영상을 H.264/AAC MP4로 변환한다.
 * faststart를 적용해 파일 전체 다운로드 전에도 재생을 시작할 수 있게 한다.
 */
const createBrowserCompatibleVideo = (inputPath, outputPath) => new Promise((resolve, reject) => {
  const ffmpeg = spawn(ffmpegExecutable, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-map_metadata', '0',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let errorOutput = '';
  ffmpeg.stderr.setEncoding('utf8');
  ffmpeg.stderr.on('data', (chunk) => {
    errorOutput = `${errorOutput}${chunk}`.slice(-8192);
  });
  ffmpeg.on('error', (error) => reject(new Error(`FFmpeg를 실행할 수 없습니다: ${error.message}`)));
  ffmpeg.on('close', (code) => {
    if (code === 0) return resolve();
    return reject(new Error(`브라우저용 영상 변환 실패 (FFmpeg ${code}): ${errorOutput.trim()}`));
  });
});

module.exports = { createBrowserCompatibleVideo, createImageThumbnail, createVideoThumbnail };
