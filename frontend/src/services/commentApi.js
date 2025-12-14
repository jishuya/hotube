// Firebase Functions URLs
const FUNCTIONS_URL = {
  createComment: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/createComment',
  getComments: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/getComments',
  updateComment: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/updateComment',
  deleteComment: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/deleteComment',
};

// 댓글 작성
export const createComment = async (videoId, userId, content) => {
  const response = await fetch(FUNCTIONS_URL.createComment, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ videoId, userId, content }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '댓글 작성에 실패했습니다');
  }

  return data;
};

// 댓글 조회 (같은 카테고리만, 관리자/부관리자는 모든 댓글 조회 가능)
export const getComments = async (videoId, category, role) => {
  const params = new URLSearchParams({ videoId, category, role });
  const response = await fetch(`${FUNCTIONS_URL.getComments}?${params}`);

  if (!response.ok) {
    throw new Error('댓글을 가져오는데 실패했습니다');
  }

  return response.json();
};

// 댓글 수정
export const updateComment = async (commentId, userId, content) => {
  const response = await fetch(`${FUNCTIONS_URL.updateComment}/${commentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, content }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '댓글 수정에 실패했습니다');
  }

  return data;
};

// 댓글 삭제
export const deleteComment = async (commentId, userId) => {
  const params = new URLSearchParams({ userId });
  const response = await fetch(`${FUNCTIONS_URL.deleteComment}/${commentId}?${params}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '댓글 삭제에 실패했습니다');
  }

  return data;
};
