const DB_NAME = 'hotube-upload-queue';
const STORE_NAME = 'uploads';
const DB_VERSION = 1;

const openDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  let settled = false;
  const timer = setTimeout(() => {
    settled = true;
    reject(new Error('임시 저장소 연결이 지연됩니다.'));
  }, 10000);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('userId', 'userId');
    }
  };
  request.onsuccess = () => {
    clearTimeout(timer);
    if (settled) request.result.close();
    else { settled = true; resolve(request.result); }
  };
  request.onerror = () => { clearTimeout(timer); settled = true; reject(request.error); };
});

const runTransaction = async (mode, operation, signal) => {
  signal?.throwIfAborted();
  const database = await openDatabase();
  try {
    signal?.throwIfAborted();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const abort = () => transaction.abort();
      const timer = setTimeout(abort, 30000);
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      signal?.addEventListener('abort', abort, { once: true });
      transaction.onabort = () => {
        cleanup();
        reject(signal?.aborted ? new DOMException('임시 저장을 취소했습니다.', 'AbortError') : transaction.error || new Error('임시 저장을 완료하지 못했습니다.'));
      };
      let request;
      transaction.oncomplete = () => { cleanup(); resolve(request.result); };
      try { request = operation(transaction.objectStore(STORE_NAME)); } catch (error) {
        cleanup();
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
};

export const savePendingUpload = (record, signal) => runTransaction('readwrite', (store) => store.put({
  ...record,
  updatedAt: Date.now(),
}), signal);

export const removePendingUpload = (id) => runTransaction('readwrite', (store) => store.delete(id));
export const getPendingUpload = (id) => runTransaction('readonly', (store) => store.get(id));
// Read keys first; load only the file being resumed, even when an old queue contains many large blobs.
export const listPendingUploadIds = (userId) => runTransaction('readonly', (store) => store.index('userId').getAllKeys(userId));
