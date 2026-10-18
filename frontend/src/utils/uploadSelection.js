export const getUploadSelectionCapacity = (existingCount, incomingCount, maximum = 10) => {
  const remaining = Math.max(0, maximum - existingCount);
  return { remaining, needsPicker: remaining > 0 && incomingCount > remaining };
};

export const excludeSelectedDuplicates = async (files, existingHashes, getHash) => {
  const seen = new Set(existingHashes);
  const attachedHashes = new Set(existingHashes);
  const unique = [];
  let duplicateCount = 0;
  let attachedDuplicateCount = 0;
  let repeatedDuplicateCount = 0;
  for (const file of files) {
    const hash = await getHash(file);
    if (seen.has(hash)) {
      duplicateCount += 1;
      if (attachedHashes.has(hash)) attachedDuplicateCount += 1;
      else repeatedDuplicateCount += 1;
    }
    else { seen.add(hash); unique.push(file); }
  }
  return { files: unique, duplicateCount, attachedDuplicateCount, repeatedDuplicateCount };
};

export const getDuplicateSelectionNotices = ({ attached = 0, uploaded = 0, repeated = 0 }) => [
  attached > 0 ? `이미 첨부한 것과 동일한 파일 ${attached}개를 제외했어요.` : '',
  uploaded > 0 ? `이미 올린 것과 동일한 파일 ${uploaded}개를 제외했어요.` : '',
  repeated > 0 ? `중복 선택한 파일 ${repeated}개를 제외했어요.` : '',
].filter(Boolean);
