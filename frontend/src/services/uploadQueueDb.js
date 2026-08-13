const DB_NAME = 'hotube-upload-queue';
const STORE_NAME = 'uploads';
const DB_VERSION = 1;

const openDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('userId', 'userId');
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const runTransaction = async (mode, operation) => {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

export const savePendingUpload = (record) => runTransaction('readwrite', (store) => store.put({
  ...record,
  updatedAt: Date.now(),
}));

export const removePendingUpload = (id) => runTransaction('readwrite', (store) => store.delete(id));

export const listPendingUploads = async (userId) => {
  const records = await runTransaction('readonly', (store) => store.getAll());
  return (records || []).filter((record) => record.userId === userId).sort((a, b) => a.updatedAt - b.updatedAt);
};
