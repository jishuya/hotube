const { spawn } = require('child_process');
const { HttpError } = require('./httpErrors');

const ffmpegExecutable = process.env.FFMPEG_PATH || 'ffmpeg';
const ffprobeExecutable = process.env.FFPROBE_PATH || 'ffprobe';

/**
 * 영상 초반 프레임들 가운데 대표 프레임을 골라 앨범용 JPEG 썸네일을 생성한다.
 * FFmpeg는 서버에 설치되어 있어야 하며, 필요하면 FFMPEG_PATH로 경로를 지정할 수 있다.
 */
const createVideoThumbnail = (inputPath, outputPath) => new Promise((resolve, reject) => {
  const ffmpeg = spawn(ffmpegExecutable, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-ss', '0.5',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', "scale='min(640,iw)':-2",
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

const probeVideo = (inputPath) => new Promise((resolve, reject) => {
  const ffprobe = spawn(ffprobeExecutable, [
    '-v', 'error',
    '-show_entries', 'format=duration,format_name,bit_rate:stream=codec_type,codec_name,pix_fmt,width,height,bit_rate',
    '-of', 'json',
    inputPath,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let errorOutput = '';
  ffprobe.stdout.setEncoding('utf8');
  ffprobe.stderr.setEncoding('utf8');
  ffprobe.stdout.on('data', (chunk) => { output += chunk; });
  ffprobe.stderr.on('data', (chunk) => { errorOutput = `${errorOutput}${chunk}`.slice(-8192); });
  ffprobe.on('error', reject);
  ffprobe.on('close', (code) => {
    if (code !== 0) return reject(new Error(`영상 정보 확인 실패 (FFprobe ${code}): ${errorOutput.trim()}`));
    try {
      return resolve(JSON.parse(output));
    } catch (error) {
      return reject(new Error(`영상 정보 해석 실패: ${error.message}`));
    }
  });
});

const validateVideoDuration = async (inputPath) => {
  let info;
  try {
    info = await probeVideo(inputPath);
  } catch {
    throw new HttpError(400, '영상 길이를 확인할 수 없습니다. 다른 영상 파일을 선택해주세요.', 'INVALID_VIDEO_DURATION');
  }
  const duration = Number(info.format?.duration);
  if (!info.streams?.some((stream) => stream.codec_type === 'video') || !Number.isFinite(duration) || duration <= 0) {
    throw new HttpError(400, '영상 길이를 확인할 수 없습니다. 다른 영상 파일을 선택해주세요.', 'INVALID_VIDEO_DURATION');
  }
  if (duration > 90) {
    throw new HttpError(400, '영상은 90초(1분 30초) 이하만 업로드할 수 있습니다.', 'VIDEO_TOO_LONG');
  }
  return duration;
};

const isBrowserCompatibleVideo = async (inputPath) => {
  const info = await probeVideo(inputPath);
  const streams = info.streams || [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const isMp4 = String(info.format?.format_name || '').split(',').some((name) => ['mov', 'mp4'].includes(name));
  return Boolean(isMp4
    && video?.codec_name === 'h264'
    && (!video.pix_fmt || video.pix_fmt === 'yuv420p')
    && (!audio || audio.codec_name === 'aac'));
};

const isPlaybackOptimizedVideo = async (inputPath) => {
  const info = await probeVideo(inputPath);
  const streams = info.streams || [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const isMp4 = String(info.format?.format_name || '').split(',').some((name) => ['mov', 'mp4'].includes(name));
  const width = Number(video?.width || 0);
  const height = Number(video?.height || 0);
  const bitrate = Number(video?.bit_rate || info.format?.bit_rate || 0);
  const dimensionIsOptimized = width > 0 && height > 0
    && (width >= height ? width <= 1920 && height <= 1080 : width <= 1080 && height <= 1920);
  const bitrateIsOptimized = bitrate <= 0 || bitrate <= 6_000_000;
  return Boolean(isMp4
    && video?.codec_name === 'h264'
    && (!video.pix_fmt || video.pix_fmt === 'yuv420p')
    && (!audio || audio.codec_name === 'aac')
    && dimensionIsOptimized
    && bitrateIsOptimized);
};

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

/** 사진 상세 화면용 1920px WebP 이미지를 생성한다. */
const createImagePreview = (inputPath, outputPath) => new Promise((resolve, reject) => {
  const ffmpeg = spawn(ffmpegExecutable, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v', 'libwebp',
    '-quality', '84',
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
    return reject(new Error(`사진 상세 이미지 생성 실패 (FFmpeg ${code}): ${errorOutput.trim()}`));
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
    '-maxrate', '5M',
    '-bufsize', '10M',
    '-vf', "scale='if(gte(iw,ih),min(1920,iw),min(1080,iw))':'if(gte(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2",
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

module.exports = {
  validateVideoDuration,
  createBrowserCompatibleVideo,
  createImagePreview,
  createImageThumbnail,
  createVideoThumbnail,
  isBrowserCompatibleVideo,
  isPlaybackOptimizedVideo,
};
