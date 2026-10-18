export const getUploadSelectionCapacity = (existingCount, incomingCount, maximum = 10) => {
  const remaining = Math.max(0, maximum - existingCount);
  return { remaining, needsPicker: remaining > 0 && incomingCount > remaining };
};

export const excludeSelectedDuplicates = async (files, existingHashes, getHash) => {
  const seen = new Set(existingHashes);
  const unique = [];
  let duplicateCount = 0;
  for (const file of files) {
    const hash = await getHash(file);
    if (seen.has(hash)) duplicateCount += 1;
    else { seen.add(hash); unique.push(file); }
  }
  return { files: unique, duplicateCount };
};
