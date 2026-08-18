const { performance } = require('perf_hooks');

const API_SLOW_MS = Number(process.env.SLOW_API_MS || 500);
const MEDIA_SLOW_MS = Number(process.env.SLOW_MEDIA_MS || 2000);

const isMediaRequest = (path) => /^\/media(?:File|Thumbnail|Preview)\//.test(path);

const performanceMetrics = (req, res, next) => {
  const startedAt = performance.now();
  const originalWriteHead = res.writeHead;

  res.writeHead = function writeHeadWithTiming(...args) {
    if (!res.headersSent) {
      const duration = performance.now() - startedAt;
      res.setHeader('Server-Timing', `app;dur=${duration.toFixed(1)}`);
      res.setHeader('Timing-Allow-Origin', '*');
    }
    return originalWriteHead.apply(this, args);
  };

  res.on('finish', () => {
    const duration = performance.now() - startedAt;
    const mediaRequest = isMediaRequest(req.path);
    const threshold = mediaRequest ? MEDIA_SLOW_MS : API_SLOW_MS;
    if (duration < threshold) return;
    console.warn(JSON.stringify({
      type: mediaRequest ? 'slow-media-response' : 'slow-api-response',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(duration),
      contentLength: Number(res.getHeader('Content-Length')) || null,
      range: Boolean(req.headers.range),
    }));
  });

  next();
};

module.exports = { performanceMetrics };
