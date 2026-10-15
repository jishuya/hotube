import { hashFileChunks } from './fileHashChunks.js';
export { hashFileChunks } from './fileHashChunks.js';

export function hashFile(file, onProgress = () => {}, signal) {
  if (typeof Worker === 'undefined') return hashFileChunks(file, onProgress, signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/fileHash.worker.js', import.meta.url), { type: 'module' });
    const finish = (error, result) => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(new DOMException('파일 확인을 취소했습니다.', 'AbortError'));
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.error) finish(new Error(data.error));
      else if (data.hash) finish(null, data.hash);
      else onProgress(data.loaded);
    };
    worker.onerror = () => finish(new Error('파일을 확인하지 못했습니다. 다시 선택해주세요.'));
    worker.postMessage(file);
  });
}
