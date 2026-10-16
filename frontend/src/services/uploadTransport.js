export const uploadRequest = (url, { method = 'POST', body, signal, onProgress, timeout = 90000 } = {}) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  const abort = () => xhr.abort();
  const finish = (error, result) => {
    signal?.removeEventListener('abort', abort);
    if (error) reject(Object.assign(error, { requestUrl: url, requestMethod: method }));
    else resolve(result);
  };
  if (signal?.aborted) {
    reject(new DOMException('업로드를 중지했습니다.', 'AbortError'));
    return;
  }
  xhr.open(method, url);
  xhr.timeout = timeout;
  xhr.responseType = 'json';
  const isChunk = body instanceof Blob;
  xhr.setRequestHeader('Content-Type', isChunk ? 'application/octet-stream' : 'application/json');
  xhr.upload.onprogress = (event) => onProgress?.(event.loaded);
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) return finish(null, xhr.response);
    const error = new Error(xhr.response?.error || '업로드 요청에 실패했습니다.');
    error.status = xhr.status;
    error.code = xhr.response?.code;
    finish(error);
  };
  xhr.onerror = () => finish(Object.assign(new TypeError('서버의 응답을 받지 못했습니다.'), { code: 'UPLOAD_NETWORK_ERROR' }));
  xhr.ontimeout = () => finish(Object.assign(new Error('연결이 지연됐어요. 다시 누르면 이어서 업로드합니다.'), { code: 'UPLOAD_TIMEOUT' }));
  xhr.onabort = () => finish(new DOMException('업로드를 중지했습니다.', 'AbortError'));
  signal?.addEventListener('abort', abort, { once: true });
  xhr.send(isChunk ? body : JSON.stringify(body || {}));
});

export const retryUploadChunk = async (operation, signal, onRetry = () => {}) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    signal?.throwIfAborted();
    try { return await operation(); } catch (error) {
      if (signal?.aborted || error.name === 'AbortError' || attempt === 2
        || (error.status && error.status < 500 && ![408, 429].includes(error.status))) throw error;
      onRetry(attempt + 1);
      await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('업로드를 중지했습니다.', 'AbortError')); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, (attempt + 1) * 1000);
        signal?.addEventListener('abort', abort, { once: true });
      });
    }
  }
};
