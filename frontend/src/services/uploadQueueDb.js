const DB_NAME = 'hotube-upload-queue';
const STORE_NAME = 'uploads';
const DB_VERSION = 2;
const SUMMARY_STORE = 'summaries';

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
    if (!database.objectStoreNames.contains(SUMMARY_STORE)) {
      const summaries = database.createObjectStore(SUMMARY_STORE, { keyPath: 'id' });
      summaries.createIndex('userId', 'userId');
      // Old queues are migrated once during the version-change transaction.
      const cursor = request.transaction.objectStore(STORE_NAME).openCursor();
      cursor.onsuccess = () => {
        const entry = cursor.result;
        if (!entry) return;
        const { id, userId, file, updatedAt } = entry.value;
        summaries.put({ id, userId, size: file?.size || 0, updatedAt });
        entry.continue();
      };
    }
  };
  request.onsuccess = () => {
    clearTimeout(timer);
    if (settled) request.result.close();
    else { settled = true; resolve(request.result); }
  };
  request.onerror = () => { clearTimeout(timer); settled = true; reject(request.error); };
});

const runTransaction = async (mode, operation, signal, storeNames = [STORE_NAME]) => {
  signal?.throwIfAborted();
  const database = await openDatabase();
  try {
    signal?.throwIfAborted();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeNames, mode);
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
      try { request = operation(transaction.objectStore(storeNames[0]), transaction); } catch (error) {
        cleanup();
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
};

export const savePendingUpload = (record, signal) => runTransaction('readwrite', (store, transaction) => {
  const updatedAt = Date.now();
  transaction.objectStore(SUMMARY_STORE).put({ id: record.id, userId: record.userId, size: record.file?.size || 0, updatedAt });
  return store.put({ ...record, updatedAt });
}, signal, [STORE_NAME, SUMMARY_STORE]);

export const removePendingUpload = (id) => runTransaction('readwrite', (store, transaction) => {
  transaction.objectStore(SUMMARY_STORE).delete(id);
  return store.delete(id);
}, undefined, [STORE_NAME, SUMMARY_STORE]);
export const getPendingUpload = (id) => runTransaction('readonly', (store) => store.get(id));
export const listPendingUploadSummaries = (userId) => runTransaction('readonly', (store) => store.index('userId').getAll(userId), undefined, [SUMMARY_STORE]);
export const listPendingUploadIds = async (userId) => (await listPendingUploadSummaries(userId)).map(({ id }) => id);
