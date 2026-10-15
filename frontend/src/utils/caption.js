// Hashtags end at whitespace, another hash or sentence punctuation.
const hashtagPattern = () => /[#＃]([^\s#＃,.!?;:，。！？；：()[\]{}<>"'“”‘’]+)/gu;

export const parseCaption = (value) => {
  const text = String(value || '');
  const parts = [];
  const tags = [];
  let offset = 0;
  for (const match of text.matchAll(hashtagPattern())) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index) });
    const tag = match[1].normalize('NFC');
    parts.push({ text: match[0], tag });
    tags.push(tag);
    offset = match.index + match[0].length;
  }
  if (offset < text.length) parts.push({ text: text.slice(offset) });
  return {
    parts,
    tags: [...new Set(tags)],
    descriptionLength: text.replace(hashtagPattern(), '').trim().length,
  };
};

export const getMediaCaption = (media) => {
  const description = media?.description || '';
  const existing = new Set(parseCaption(description).tags);
  const missing = [...new Set(media?.tags || [])].filter((tag) => !existing.has(tag.normalize('NFC')));
  return [description, missing.map((tag) => `#${tag}`).join(' ')].filter(Boolean).join('\n');
};

export const removeCaptionTag = (value, tag) => String(value || '').replace(
  hashtagPattern(), (match, name) => name.normalize('NFC') === tag.normalize('NFC') ? '' : match,
).trim();
