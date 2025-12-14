import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import { getComments, createComment, updateComment, deleteComment } from '../../services/commentApi';

const CommentSection = ({ videoId }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

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

  const handleEdit = (comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editContent.trim()) return;

    try {
      const updated = await updateComment(commentId, user.id, editContent.trim());
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: updated.content, updatedAt: updated.updatedAt } : c));
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('댓글 수정 실패:', error);
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
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 sm:p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
          <Icon icon="mdi:comment-multiple" className="text-primary text-lg" />
          댓글
          <span className="text-sm font-normal text-zinc-500">
            ({comments.length})
          </span>
        </h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {isAdminOrSubAdmin ? '모든 댓글' : `${getCategoryLabel(user?.category)} 전용`}
        </span>
      </div>

      {/* 댓글 입력 */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="댓글을 입력하세요..."
              rows={2}
              className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="shrink-0 px-3 h-10 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {submitting ? (
              <Icon icon="mdi:loading" className="animate-spin text-lg" />
            ) : (
              <Icon icon="mdi:send" className="text-lg" />
            )}
          </button>
        </div>
      </form>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Icon icon="mdi:loading" className="text-2xl text-primary animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-2 text-zinc-500">
          <Icon icon="mdi:comment-off-outline" className="hidden sm:block text-3xl mb-1 mx-auto opacity-50" />
          <p className="text-sm">아직 댓글이 없습니다</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="shrink-0">
                <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center">
                  <Icon icon="mdi:account" className="text-sm text-zinc-500 dark:text-zinc-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {comment.userName}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {comment.userTitle}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500">
                    · {formatDate(comment.createdAt)}
                    {comment.updatedAt && comment.updatedAt !== comment.createdAt && ' (수정됨)'}
                  </span>
                  {comment.userId === user?.id && editingId !== comment.id && (
                    <button
                      onClick={() => handleEdit(comment)}
                      className="text-zinc-400 hover:text-primary transition-colors ml-auto"
                    >
                      <Icon icon="mdi:pencil-outline" />
                    </button>
                  )}
                  {(comment.userId === user?.id || user?.role === 'admin') && editingId !== comment.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className={`text-zinc-400 hover:text-red-500 transition-colors ${comment.userId !== user?.id ? 'ml-auto' : ''}`}
                    >
                      <Icon icon="mdi:delete-outline" />
                    </button>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div className="mt-1">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="w-full p-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-700 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={!editContent.trim()}
                        className="text-xs px-2 py-1 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-xs px-2 py-1 bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-500"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
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
