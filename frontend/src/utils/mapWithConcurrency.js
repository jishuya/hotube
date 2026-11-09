export async function mapWithConcurrency(items, limit, operation, signal) {
  const results = new Array(items.length);
  let next = 0;
  let failure;
  const worker = async () => {
    while (next < items.length && !failure) {
      const index = next++;
      try {
        signal?.throwIfAborted();
        results[index] = await operation(items[index], index);
      } catch (error) { failure ||= error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw failure;
  signal?.throwIfAborted();
  return results;
}
