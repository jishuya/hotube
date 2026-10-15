import { sha256 } from '@noble/hashes/sha2.js';

export async function hashFileChunks(file, onProgress = () => {}, signal) {
  const hash = sha256.create();
  const chunkSize = 1024 * 1024;
  try {
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      signal?.throwIfAborted();
      hash.update(new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer()));
      onProgress(Math.min(offset + chunkSize, file.size));
      // Also yield when running without Worker support.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    signal?.throwIfAborted();
    return Array.from(hash.digest(), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } finally {
    hash.destroy();
  }
}

