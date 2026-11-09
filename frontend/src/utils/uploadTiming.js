// Inspect recent upload phases in the browser Performance panel without storing file names.
export async function measureUploadStep(phase, bytes, operation) {
  const start = performance.now();
  let success = false;
  try {
    const result = await operation();
    success = true;
    return result;
  } finally {
    try {
      const name = `hotube-upload:${phase}`;
      const previous = performance.getEntriesByName(name, 'measure');
      if (previous.length >= 100) performance.clearMeasures(name);
      performance.measure(name, { start, end: performance.now(), detail: { bytes, success } });
    } catch { /* Diagnostics must never interrupt an upload. */ }
  }
}
