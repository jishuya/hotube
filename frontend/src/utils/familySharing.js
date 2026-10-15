export const getDefaultSharedWith = (user) => {
  if (['admin', 'sub-admin'].includes(user?.role)) return ['dad', 'mom'];
  if (['dad', 'mom'].includes(user?.category)) return [user.category];
  return ['dad', 'mom'];
};

export const getDefaultCommentSharedWith = (user) => {
  if (['dad', 'mom'].includes(user?.category)) return [user.category];
  return ['admin', 'sub-admin'].includes(user?.role) ? ['dad', 'mom'] : ['etc'];
};
