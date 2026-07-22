import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CommentSection from '../components/video/CommentSection';
import Modal from '../components/common/Modal';
import {
  deleteVideo,
  getAllVideos,
  getMediaDetails,
  toMemoryMedia,
  toggleFavorite,
  updateVideo,
} from '../services/videoApi';
import { markVideoWatched, toggleLike } from '../services/authApi';
import { extractVideoId } from '../services/youtubeService';
import { getChildProfile } from '../services/childProfileApi';
import { addDateAlbumTag, getDateAlbumTags } from '../services/dateAlbumTagApi';
import { useAuth } from '../contexts/AuthContext';

const avatarPositions = [
  [0, 9], [25, 9], [50, 9], [75, 9], [100, 9],
  [0, 89], [25, 89], [50, 89], [75, 89], [100, 89],
];

const getAvatarPosition = (person) => {
  const source = person?.avatar || person?.id || person?.title || 'family';
  const index = [...source].reduce((total, character) => total + character.charCodeAt(0), 0) % avatarPositions.length;
  return avatarPositions[index];
};

const FamilyAvatar = ({ person, className = 'size-8' }) => {
  const [x, y] = getAvatarPosition(person);
  return (
    <span
      role="img"
      aria-label={person?.name || person?.title || '가족'}
      title={person?.title || person?.name || '가족'}
      className={`inline-block shrink-0 rounded-full border-2 border-white bg-primary/10 shadow-sm ${className}`}
      style={{
        backgroundImage: "url('/avatars/hotube-family-avatars.png')",
        backgroundPosition: `${x}% ${y}%`,
        backgroundSize: '500% auto',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

const formatChildDay = (birthday, mediaDate) => {
  if (!birthday || !mediaDate) return mediaDate;
  const birth = new Date(`${birthday}T00:00:00Z`);
  const captured = new Date(`${mediaDate}T00:00:00Z`);
  const days = Math.round((captured - birth) / 86400000);
  const sign = days >= 0 ? '+' : '-';
  return `D${sign}${String(Math.abs(days)).padStart(2, '0')} (${mediaDate})`;
};

const getNextDate = (date) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

const ActionButton = ({ icon, label, active = false, count, onClick, href, disabled = false }) => {
  const className = `flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
    active ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-primary/10 hover:text-primary'
  } ${disabled ? 'pointer-events-none opacity-40' : ''}`;
  const content = (
    <>
      <Icon icon={icon} className="text-2xl" />
      <span>{label}{count !== undefined ? ` ${count}` : ''}</span>
    </>
  );
  return href ? <a href={href} download className={className}>{content}</a> : (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>{content}</button>
  );
};

const MediaViewerPage = () => {
  const { mediaId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const commentsRef = useRef(null);
  const tagSavingRef = useRef(false);
  const { user, isLiked, toggleLikeLocal, markWatchedLocal } = useAuth();
  const [mediaItems, setMediaItems] = useState([]);
  const [details, setDetails] = useState(null);
  const [child, setChild] = useState(null);
  const [dateTags, setDateTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [sharedWith, setSharedWith] = useState(['dad', 'mom']);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState('');

  const requestedDate = searchParams.get('date');
  const returnTo = location.state?.returnTo === '/album' ? '/album' : '/calendar';
  const current = mediaItems.find((item) => item.id === mediaId);
  const date = requestedDate || current?.date;
  const items = useMemo(() => mediaItems.filter((item) => item.date === date), [mediaItems, date]);
  const currentIndex = items.findIndex((item) => item.id === mediaId);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  const loadDetails = () => getMediaDetails(mediaId, user?.id)
    .then((data) => {
      setDetails(data);
      setSharedWith(data.sharedWith?.length ? data.sharedWith : ['dad', 'mom']);
    })
    .catch((loadError) => setError(loadError.message));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAllVideos().then((allMedia) => setMediaItems(allMedia.map(toMemoryMedia))),
      loadDetails(),
    ]).finally(() => setLoading(false));
  }, [mediaId, user?.id]);

  useEffect(() => {
    getChildProfile()
      .then(setChild)
      .catch((profileError) => console.error('아이 정보 조회 실패:', profileError));
  }, []);

  useEffect(() => {
    if (!current?.date) return;
    getDateAlbumTags({ dateFrom: current.date, dateTo: getNextDate(current.date) })
      .then((tagsByDate) => setDateTags(tagsByDate[current.date] || []))
      .catch((tagError) => setError(tagError.message));
  }, [current?.date]);

  useEffect(() => {
    if (!current) return;
    setEditDate(current.date || '');
  }, [current]);

  useEffect(() => {
    if (!current || !user || user.watchedVideos?.includes(current.id)) return;
    markVideoWatched(user.id, current.id)
      .then(() => {
        markWatchedLocal(current.id);
        return loadDetails();
      })
      .catch((watchError) => console.error('시청 기록 추가 실패:', watchError));
  }, [current, user, markWatchedLocal]);

  const moveTo = (item) => {
    if (item) navigate(`/media/${item.id}?date=${date}`, { state: { returnTo } });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft' && previous) moveTo(previous);
      if (event.key === 'ArrowRight' && next) moveTo(next);
      if (event.key === 'Escape') {
        if (editing) setEditing(false);
        else navigate(`/calendar/${date}`, { state: { returnTo } });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleLike = async () => {
    if (!user || busyAction) return;
    setBusyAction('like');
    try {
      await toggleLike(user.id, mediaId);
      const wasLiked = isLiked(mediaId);
      toggleLikeLocal(mediaId);
      setDetails((value) => ({ ...value, likeCount: Math.max(0, value.likeCount + (wasLiked ? -1 : 1)) }));
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyAction('');
    }
  };

  const handleFavorite = async () => {
    if (!user || busyAction) return;
    setBusyAction('favorite');
    try {
      const result = await toggleFavorite(user.id, mediaId);
      setDetails((value) => ({ ...value, favorited: result.favorited }));
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyAction('');
    }
  };

  const toggleFamily = (category) => {
    setSharedWith((value) => value.includes(category)
      ? value.filter((item) => item !== category)
      : [...value, category]);
  };

  const submitTag = async (event) => {
    event.preventDefault();
    if (tagSavingRef.current) return;
    const tag = tagDraft.trim().replace(/^#/, '');
    if (!tag || dateTags.includes(tag)) {
      setTagDraft('');
      setAddingTag(false);
      return;
    }
    tagSavingRef.current = true;
    try {
      await addDateAlbumTag(current.date, tag);
      setDateTags((value) => [...value, tag]);
      setTagDraft('');
      setAddingTag(false);
      window.dispatchEvent(new Event('hotube:media-updated'));
    } catch (tagError) {
      setError(tagError.message);
    } finally {
      tagSavingRef.current = false;
    }
  };

  const saveMetadata = async () => {
    if (!editDate || sharedWith.length === 0) {
      setError('날짜와 공유할 가족을 한 명 이상 선택해 주세요.');
      return;
    }
    setBusyAction('save');
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, { uploadedAt: editDate, sharedWith }));
      setMediaItems((value) => value.map((item) => item.id === mediaId ? saved : item));
      setDetails((value) => ({ ...value, sharedWith }));
      setEditing(false);
      window.dispatchEvent(new Event('hotube:media-updated'));
      if (editDate !== date) navigate(`/media/${mediaId}?date=${editDate}`, { replace: true });
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyAction('');
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteVideo(mediaId);
      window.dispatchEvent(new Event('hotube:media-updated'));
      navigate(`/calendar/${date}`, { replace: true, state: { returnTo } });
    } catch (actionError) {
      setError(actionError.message);
    }
  };

  const shareLabel = sharedWith.length > 1
    ? '여러 가족 공유'
    : sharedWith[0] === 'mom' ? '엄마가족만 공유' : '아빠가족만 공유';

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-background"><Icon icon="mdi:loading" className="animate-spin text-4xl text-primary" /></main>;
  }

  if (!current) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-text-primary">
        <Icon icon="mdi:image-off-outline" className="mb-4 text-6xl text-primary/35" />
        <h1 className="text-xl font-bold">미디어를 찾을 수 없어요.</h1>
        <Link to="/calendar" className="mt-5 rounded-full bg-primary px-5 py-2.5 font-semibold text-white">캘린더로 돌아가기</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-16 text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to={`/calendar/${date}`} state={{ returnTo }} className="flex size-10 items-center justify-center rounded-full hover:bg-primary/10" aria-label="날짜 앨범으로 돌아가기">
            <Icon icon="mdi:arrow-left" className="text-2xl" />
          </Link>
          <div className="text-center">
            <p className="text-sm font-bold">추억 보기</p>
            <p className="text-xs text-text-secondary">{currentIndex + 1} / {items.length}</p>
          </div>
          <button type="button" onClick={() => setEditing((value) => !value)} className="flex size-10 items-center justify-center rounded-full hover:bg-primary/10" aria-label="미디어 정보 수정">
            <Icon icon="mdi:dots-horizontal" className="text-2xl" />
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <div className="min-w-0">
          <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
            <div className="flex justify-center bg-surface px-4 py-2">
              <span className="rounded-xl bg-orange-50 px-5 py-1.5 text-center text-xs font-bold text-orange-700">
                {formatChildDay(child?.birthday, current.date)}
              </span>
            </div>
            <div className={`relative flex items-center justify-center border-b border-border bg-white ${current.type === 'photo' ? '' : 'min-h-[48vh] sm:min-h-[65vh]'}`}>
              {current.source === 'youtube' ? (
                <iframe src={`https://www.youtube.com/embed/${extractVideoId(current.src)}?autoplay=1`} title={current.title} allowFullScreen className="aspect-video w-full" />
              ) : current.type === 'video' ? (
                <video src={current.src} poster={current.thumbnail} controls autoPlay className="max-h-[75vh] max-w-full object-contain" />
              ) : (
                <img src={current.src} alt={current.title} className="block max-h-[75vh] w-full object-contain" />
              )}
              <button type="button" onClick={() => moveTo(previous)} disabled={!previous} className="absolute left-3 flex size-11 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md disabled:hidden" aria-label="이전 미디어"><Icon icon="mdi:chevron-left" /></button>
              <button type="button" onClick={() => moveTo(next)} disabled={!next} className="absolute right-3 flex size-11 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md disabled:hidden" aria-label="다음 미디어"><Icon icon="mdi:chevron-right" /></button>
            </div>

            <div className="px-5 pb-3 pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {current.source === 'youtube' && (
                  <h1 className="truncate text-xl font-bold sm:text-2xl">{current.title}</h1>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5"><FamilyAvatar person={details?.uploader} className="size-6" />by {details?.uploader?.title || details?.uploader?.name || '가족'}</span>
                {details?.viewers?.length > 0 && (
                  <><span>·</span><span className="inline-flex items-center gap-1.5"><span className="flex -space-x-1">{details.viewers.slice(0, 4).map((viewer) => <FamilyAvatar key={viewer.id} person={viewer} className="size-6" />)}</span>{details.viewers.length}명 조회</span></>
                )}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold"><Icon icon="mdi:account-group-outline" />{shareLabel}</span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <ActionButton icon={isLiked(mediaId) ? 'mdi:heart' : 'mdi:heart-outline'} label="좋아요" count={details?.likeCount || 0} active={isLiked(mediaId)} onClick={handleLike} />
              <ActionButton icon={details?.favorited ? 'mdi:bookmark' : 'mdi:bookmark-outline'} label="즐겨찾기" active={details?.favorited} onClick={handleFavorite} />
              <ActionButton icon="mdi:comment-outline" label="댓글" count={details?.commentCount || 0} onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
              <ActionButton icon="mdi:download-outline" label="다운로드" href={current.source === 'file' ? current.src : undefined} disabled={current.source !== 'file'} />
            </div>

            <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5 text-xs">
              {[...new Set([...(current.tags || []), ...dateTags])].map((tag) => <span key={tag} className="text-text-secondary">#{tag}</span>)}
              {addingTag ? (
                <form onSubmit={submitTag} className="flex items-center gap-1">
                  <input autoFocus value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onBlur={submitTag} onKeyDown={(event) => { if (event.key === 'Escape') { setTagDraft(''); setAddingTag(false); } }} placeholder="태그" className="h-6 w-24 rounded-full border-primary bg-surface px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary" />
                </form>
              ) : (
                <button type="button" onClick={() => setAddingTag(true)} className="font-semibold text-primary hover:underline">+ 태그</button>
              )}
            </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div ref={commentsRef}>
            <CommentSection
              videoId={mediaId}
              onCountChange={(commentCount) => setDetails((value) => value ? { ...value, commentCount } : value)}
            />
          </div>
        </aside>
      </div>

      {editing && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={() => setEditing(false)} aria-label="미디어 수정 닫기" />
          <section className="relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl" aria-labelledby="media-edit-title">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="media-edit-title" className="text-lg font-bold">미디어 수정</h2>
                <p className="mt-0.5 text-xs text-text-secondary">날짜와 공유 가족을 변경할 수 있어요.</p>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10" aria-label="닫기"><Icon icon="mdi:close" className="text-xl" /></button>
            </div>
            <label className="mt-5 block text-sm font-semibold">날짜<input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 focus:border-primary focus:ring-primary/30" /></label>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">공유 가족</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[['mom', '엄마가족'], ['dad', '아빠가족']].map(([value, label]) => <button key={value} type="button" onClick={() => toggleFamily(value)} className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${sharedWith.includes(value) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}><Icon icon={sharedWith.includes(value) ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="mr-1 inline" />{label}</button>)}
              </div>
            </fieldset>
            <button type="button" onClick={saveMetadata} disabled={busyAction === 'save'} className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50">{busyAction === 'save' ? '저장 중...' : '변경사항 저장'}</button>
            <button type="button" onClick={() => { setEditing(false); setDeleteOpen(true); }} className="mt-2 h-10 w-full rounded-xl bg-error text-sm font-bold text-white transition hover:opacity-90"><Icon icon="mdi:delete-outline" className="mr-1 inline text-lg" />사진·영상 삭제</button>
          </section>
        </div>
      )}

      {error && <button type="button" onClick={() => setError('')} className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-error px-4 py-2 text-sm font-semibold text-white shadow-lg">{error}</button>}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} title="미디어 삭제" message="이 사진 또는 영상을 삭제할까요? 삭제한 파일은 복구할 수 없습니다." type="confirm" confirmText="삭제" />
    </main>
  );
};

export default MediaViewerPage;
