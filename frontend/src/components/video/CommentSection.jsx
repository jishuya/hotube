import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import { getComments, createComment, deleteComment } from '../../services/commentApi';

const CommentSection = ({ videoId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isAdminOrSubAdmin = user?.role === 'admin' || user?.role === 'sub-admin';

  useEffect(() => {
    if (videoId && user) {
      loadComments();
    }
  }, [videoId, user?.category, user?.role]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await getComments(videoId, user.category, user.role);
      setComments(data);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const comment = await createComment(videoId, user.id, newComment.trim());
      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('댓글 작성 실패:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      await deleteComment(commentId, user.id);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString();
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'dad': return '아빠가족';
      case 'mom': return '엄마가족';
      default: return '기타';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Icon icon="mdi:comment-multiple" className="text-primary" />
          댓글
          <span className="text-sm font-normal text-zinc-500">
            ({comments.length})
          </span>
        </h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
          {isAdminOrSubAdmin ? '모든 댓글' : `${getCategoryLabel(user?.category)} 전용`}
        </span>
      </div>

      {/* 댓글 입력 */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <div className="shrink-0">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Icon icon="mdi:account" className="text-xl text-primary" />
            </div>
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="w-full min-h-[80px] p-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Icon icon="mdi:loading" className="animate-spin" />
                    작성 중...
                  </>
                ) : (
                  <>
                    <Icon icon="mdi:send" />
                    작성
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Icon icon="mdi:loading" className="text-3xl text-primary animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <Icon icon="mdi:comment-off-outline" className="text-4xl mb-2 mx-auto opacity-50" />
          <p>아직 댓글이 없습니다</p>
          <p className="text-sm">첫 번째 댓글을 남겨보세요!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center">
                  <Icon icon="mdi:account" className="text-xl text-zinc-500 dark:text-zinc-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {comment.userName}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {comment.userTitle}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    · {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
                {/* 삭제 버튼 (본인 댓글 또는 관리자만) */}
                {(comment.userId === user?.id || user?.role === 'admin') && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="mt-2 text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <Icon icon="mdi:delete-outline" />
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
