import { getDefaultCommentSharedWith } from '../../utils/familySharing';
import { useCallback, useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import { getComments, createComment, updateComment, deleteComment } from '../../services/commentApi';
import Modal from '../common/Modal';
import { AVATAR_POSITIONS } from '../../constants/profileAvatars';

const getCommentAudience = (sharedWith) => {
  if (sharedWith?.length === 1 && sharedWith[0] === 'mom') {
    return { label: '엄마가족', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' };
  }
  if (sharedWith?.length === 1 && sharedWith[0] === 'dad') {
    return { label: '아빠가족', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' };
  }
  if (sharedWith?.length === 1 && sharedWith[0] === 'etc') {
    return { label: '기타 가족', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200' };
  }
  return { label: '양쪽 가족', color: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200' };
};

const CommentAvatar = ({ comment }) => {
  const [x, y] = AVATAR_POSITIONS[comment.userAvatar] || AVATAR_POSITIONS['woman-long'];
  return (
    <span
      role="img"
      aria-label={`${comment.userName || comment.userTitle || '사용자'} 프로필`}
      className="block size-8 rounded-full border border-white bg-primary/10 shadow-sm"
      style={{
        backgroundImage: "url('/avatars/hotube-family-avatars-v2.png')",
        backgroundPosition: `${x}% ${y}%`,
        backgroundSize: '500% 480%',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

const CommentSection = ({ videoId, onCountChange }) => {
  const { user } = useAuth();
  const canChooseAudience = ['admin', 'sub-admin'].includes(user?.role);
  const ownAudience = getCommentAudience([user?.category]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [sharedWith, setSharedWith] = useState(() => getDefaultCommentSharedWith(user));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, commentId: null });

  const loadComments = useCallback(async () => {
    if (!videoId || !user?.id) return;
    try {
      setLoading(true);
      const data = await getComments(videoId, user.id);
      setComments(data);
      onCountChange?.(data.length);
    } catch (error) {
      console.error('댓글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [onCountChange, user?.id, videoId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const comment = await createComment(videoId, user.id, newComment.trim(), sharedWith);
      setComments(prev => [comment, ...prev]);
      onCountChange?.(comments.length + 1);
      setNewComment('');
      setSharedWith(getDefaultCommentSharedWith(user));
    } catch (error) {
      console.error('댓글 작성 실패:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (commentId) => {
    setDeleteModal({ isOpen: true, commentId });
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteComment(deleteModal.commentId, user.id);
      setComments(prev => prev.filter(c => c.id !== deleteModal.commentId));
      onCountChange?.(Math.max(0, comments.length - 1));
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

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 sm:p-4">
      {/* 헤더 */}
      <div className="flex items-center mb-3">
        <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
          <Icon icon="mdi:comment-multiple" className="text-primary text-lg" />
          댓글
          <span className="text-sm font-normal text-zinc-500">
            ({comments.length})
          </span>
        </h3>
      </div>

      {/* 댓글 입력 */}
      <form onSubmit={handleSubmit} className="mb-5 flex items-start gap-2 sm:gap-3">
        <div className="shrink-0 pt-1">
          <CommentAvatar comment={{ userAvatar: user?.avatar, userName: user?.name, userTitle: user?.title }} />
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            aria-label="댓글 내용"
            placeholder="댓글 추가..."
            rows={1}
            disabled={submitting}
            className="block min-h-10 w-full resize-y rounded-none border-0 border-b border-zinc-300 bg-transparent px-0 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:ring-0 disabled:opacity-60 dark:border-zinc-600 dark:text-white"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            {canChooseAudience ? (
              <fieldset disabled={submitting} className="min-w-0">
                <legend className="sr-only">공유 가족</legend>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs font-semibold text-black dark:text-white">공유</span>
                  {[['dad', '아빠가족'], ['mom', '엄마가족']].map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={sharedWith.includes(value)}
                      onClick={() => setSharedWith((current) => current.includes(value)
                        ? (current.length > 1 ? current.filter((item) => item !== value) : current)
                        : [...current, value])}
                      className={`inline-flex h-7 items-center gap-0.5 whitespace-nowrap rounded-full px-1 text-xs font-semibold transition hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-700 ${sharedWith.includes(value) ? 'text-primary' : 'text-text-secondary'}`}>
                      <Icon icon={sharedWith.includes(value) ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="shrink-0 text-sm" />{label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <span title={`${ownAudience.label}과 관리자·부관리자에게만 보여요.`} className={`rounded-full px-2 py-1 text-xs font-semibold ${ownAudience.color}`}>
                {ownAudience.label} 공개
              </span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button type="button" disabled={submitting}
                onClick={() => { setNewComment(''); setSharedWith(getDefaultCommentSharedWith(user)); }}
                className="h-8 rounded-full px-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-200 dark:hover:bg-zinc-700 sm:px-3 sm:text-sm">
                취소
              </button>
              <button type="submit" disabled={!newComment.trim() || submitting}
                className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-700 sm:px-4 sm:text-sm">
                {submitting && <Icon icon="mdi:loading" className="animate-spin" />}
                {submitting ? '저장 중' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Icon icon="mdi:loading" className="text-2xl text-primary animate-spin" />
        </div>
      ) : comments.length > 0 ? (
        <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="shrink-0">
                <CommentAvatar comment={comment} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {comment.userName}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${getCommentAudience(comment.sharedWith).color}`}>
                    {getCommentAudience(comment.sharedWith).label}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {comment.userTitle}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-500">
                    · {formatDate(comment.createdAt)}
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
                      onClick={() => handleDeleteClick(comment.id)}
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
      ) : null}

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, commentId: null })}
        onConfirm={handleDeleteConfirm}
        title="댓글 삭제"
        message="댓글을 삭제하시겠습니까?"
        type="confirm"
        confirmText="삭제"
        cancelText="취소"
      />
    </div>
  );
};

export default CommentSection;
