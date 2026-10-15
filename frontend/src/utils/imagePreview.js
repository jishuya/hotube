// Keep only a small bitmap for the selection UI; the original File is still uploaded unchanged.
export async function createUploadPreview(file) {
  if (typeof createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { resizeWidth: 640, resizeQuality: 'medium' });
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      canvas.width = canvas.height = 0;
      if (blob) return URL.createObjectURL(blob);
    } catch {
      // Some browsers cannot decode HEIC or do not support resize options.
    } finally {
      bitmap?.close();
    }
  }
  return URL.createObjectURL(file);
}
