const { HttpError } = require('../httpErrors');
const getDefaultSharedWith = (user) => {
  if (['admin', 'sub-admin'].includes(user?.role)) return ['dad', 'mom'];
  if (['dad', 'mom'].includes(user?.category)) return [user.category];
  return ['dad', 'mom'];
};
const getDefaultCommentSharedWith = (user) => {
  if (['admin', 'sub-admin'].includes(user?.role)) return [];
  if (['dad', 'mom'].includes(user?.category)) return [user.category];
  return ['etc'];
};
const resolveCommentSharing = (value, user) => {
  // 일반 가족은 요청 값과 관계없이 본인 가족에게만 댓글을 공개한다.
  if (!['admin', 'sub-admin'].includes(user?.role)) {
    return getDefaultCommentSharedWith(user);
  }
  if (value === undefined) return getDefaultCommentSharedWith(user);
  if (!Array.isArray(value) || value.some((item) => !['dad', 'mom'].includes(item))) {
    throw new HttpError(400, '공유할 가족을 선택해주세요');
  }
  return [...new Set(value)];
};
module.exports = { getDefaultSharedWith, resolveCommentSharing };
