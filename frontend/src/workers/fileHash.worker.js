import { hashFileChunks } from '../utils/fileHashChunks';
self.onmessage = async ({ data: file }) => {
  try {
    const hash = await hashFileChunks(file, (loaded) => self.postMessage({ loaded }));
    self.postMessage({ hash });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
