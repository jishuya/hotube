const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const FUNCTIONS_URL = {
  createComment: `${API_BASE_URL}/createComment`,
  getComments: `${API_BASE_URL}/getComments`,
  updateComment: `${API_BASE_URL}/updateComment`,
  deleteComment: `${API_BASE_URL}/deleteComment`,
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

// 미디어를 공유받은 모든 가족의 댓글 조회
export const getComments = async (videoId, userId) => {
  const params = new URLSearchParams({ videoId, userId });
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
