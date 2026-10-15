export const parseTags = (value) => [...new Set(
  String(value || '').normalize('NFC').split(/[\s,#＃]+/u).filter(Boolean),
)];
