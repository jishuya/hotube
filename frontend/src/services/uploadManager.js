import { uploadMediaFile } from './videoApi.js';
import { listPendingUploadSummaries, getPendingUpload, savePendingUpload, removePendingUpload } from './uploadQueueDb.js';
import { getUploadFailureMessage } from '../utils/uploadFeedback.js';

// Own transfers outside React pages so route changes only detach the UI.
export const createUploadManager = (dependencies) => {
  const { upload, list, get, save, remove, notify = () => {} } = dependencies;
  const listeners = new Set();
  let userId = null;
  let controller;
  let task;
  let recoveryRequested = false;
  let memory = new Map();
  const empty = () => ({ userId, running: false, paused: false, pending: 0, transfer: null,
    total: 0, completed: 0, totalBytes: 0, completedBytes: 0, notice: '', error: '' });
  let state = empty();
  const publish = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const execute = (records, manual = false) => {
    if (!userId || task || state.running || (state.paused && !manual)) return Promise.resolve(null);
    const owner = userId;
    const runMemory = memory;
    const runController = new AbortController();
    controller = runController;
    recoveryRequested = false;
    publish({ running: true, paused: false, error: '', notice: '', transfer: null });
    // Reserve ownership before the first asynchronous queue read.
    task = Promise.resolve().then(async () => {
      const created = [];
      const duplicates = [];
      let failure;
      try {
        if (records) {
          for (const record of records) runMemory.set(record.id, record);
        } else {
          for (const summary of await list(owner)) {
            runController.signal.throwIfAborted();
            if (!runMemory.has(summary.id)) runMemory.set(summary.id, summary);
          }
        }
        runController.signal.throwIfAborted();
        const queued = [...runMemory.values()];
        publish({ total: queued.length, completed: 0, pending: queued.length,
          totalBytes: queued.reduce((sum, item) => sum + (item.file?.size || item.size || 0), 0), completedBytes: 0 });
        // Save the complete selection before starting any network transfer.
        let saved = 0;
        let unsaved = 0;
        const toSave = records || queued.filter((record) => record.file);
        for (const record of toSave) {
          runController.signal.throwIfAborted();
          publish({ transfer: { phase: 'saving', name: record.file.name, loaded: 0 } });
          try {
            await save(record, runController.signal);
            saved += 1;
          } catch (error) {
            if (runController.signal.aborted) throw error;
            unsaved += 1;
          }
          runController.signal.throwIfAborted();
          if (unsaved) publish({ notice: `${toSave.length}개 중 ${saved}개 임시 저장 완료. 저장하지 못한 파일은 앱이 종료되면 다시 선택해야 해요.` });
        }
        for (const entry of queued) {
          runController.signal.throwIfAborted();
          const record = entry.file ? entry : await get(entry.id);
          runController.signal.throwIfAborted();
          if (!record) { runMemory.delete(entry.id); publish({ pending: runMemory.size }); continue; }
          let accepted = true;
          try {
            const result = await upload(record.file, record.options, {
              signal: runController.signal,
              onProgress: (progress) => {
                if (userId === owner && !runController.signal.aborted) publish({ transfer: { ...progress, name: record.file.name } });
              },
            });
            created.push(result);
          } catch (error) {
            if (error.code === 'DUPLICATE_MEDIA') duplicates.push(record.file.name);
            else if (error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
              // Invalid files should not prevent the remaining queue from uploading.
              failure = error;
              accepted = false;
            } else throw error;
          }
          runController.signal.throwIfAborted();
          await remove(record.id).catch(() => {});
          runController.signal.throwIfAborted();
          runMemory.delete(record.id);
          publish({ completed: state.completed + (accepted ? 1 : 0), pending: runMemory.size,
            completedBytes: state.completedBytes + record.file.size, transfer: null });
        }
      } catch (error) {
        failure = error;
      } finally {
        if (userId === owner && runMemory === memory) {
          publish({ running: false, pending: runMemory.size, transfer: null,
            error: failure ? getUploadFailureMessage(failure) : '' });
          if (created.length) notify(created);
        }
      }
      return { created, duplicates, failure, pending: runMemory.size, pendingIds: [...runMemory.keys()] };
    }).finally(() => {
      task = null;
      controller = null;
      if (userId !== owner || runMemory !== memory) {
        void resume();
      } else if (recoveryRequested && !state.paused && runMemory.size) {
        recoveryRequested = false;
        void resume();
      }
    });
    return task;
  };

  const resume = ({ manual = false } = {}) => {
    if (task) { if (!state.paused) recoveryRequested = true; return task; }
    return execute(null, manual);
  };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    setUser(nextUserId) {
      if (nextUserId === userId) return;
      controller?.abort();
      userId = nextUserId;
      memory = new Map();
      recoveryRequested = false;
      state = empty();
      publish({});
    },
    start: (records) => {
      if (records.some((record) => record.userId !== userId || record.options?.uploadedBy !== userId)) return Promise.resolve(null);
      return execute(records, true);
    },
    dismiss() { if (!state.running && !state.pending) publish({ total: 0, error: '', notice: '' }); },
    resume,
    pause() { recoveryRequested = false; publish({ paused: true }); controller?.abort(); },
  };
};

export const uploadManager = createUploadManager({
  upload: uploadMediaFile, list: listPendingUploadSummaries, get: getPendingUpload,
  save: savePendingUpload, remove: removePendingUpload,
  notify: () => window.dispatchEvent(new Event('hotube:media-updated')),
});

export const bindUploadRecovery = (manager, win, doc) => {
  const recover = () => {
    if (doc.visibilityState === 'visible' && win.navigator.onLine !== false) void manager.resume();
  };
  win.addEventListener('online', recover);
  win.addEventListener('pageshow', recover);
  doc.addEventListener('visibilitychange', recover);
  return () => {
    win.removeEventListener('online', recover);
    win.removeEventListener('pageshow', recover);
    doc.removeEventListener('visibilitychange', recover);
  };
};
