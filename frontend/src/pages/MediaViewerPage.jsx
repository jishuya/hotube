import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CommentSection from '../components/video/CommentSection';
import Modal from '../components/common/Modal';
import ToastContainer from '../components/common/Toast';
import DatePickerField from '../components/common/DatePickerField';
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  getMediaDetails,
  toMemoryMedia,
  toggleFavorite,
  updateVideo,
} from '../services/videoApi';
import { markVideoWatched, toggleLike } from '../services/authApi';
import { dismissMediaNotifications } from '../services/pushApi';
import { extractVideoId } from '../services/youtubeService';
import { getChildProfile } from '../services/childProfileApi';
import { useAuth } from '../contexts/AuthContext';
import { AVATAR_POSITIONS } from '../constants/profileAvatars';

const getAvatarPosition = (person) => {
  if (person?.avatar && AVATAR_POSITIONS[person.avatar]) return AVATAR_POSITIONS[person.avatar];
  const source = person?.avatar || person?.id || person?.title || 'family';
  const fallbackPositions = Object.values(AVATAR_POSITIONS);
  const index = [...source].reduce((total, character) => total + character.charCodeAt(0), 0) % fallbackPositions.length;
  return fallbackPositions[index];
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
        backgroundImage: "url('/avatars/hotube-family-avatars-v2.png')",
        backgroundPosition: `${x}% ${y}%`,
        backgroundSize: '500% 480%',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

const formatChildDay = (birthday, mediaDate) => {
  if (!birthday || !mediaDate) return { day: null, date: mediaDate };
  const birth = new Date(`${birthday}T00:00:00Z`);
  const captured = new Date(`${mediaDate}T00:00:00Z`);
  const days = Math.round((captured - birth) / 86400000);
  const sign = days >= 0 ? '+' : '-';
  return {
    day: `D${sign}${String(Math.abs(days)).padStart(2, '0')}`,
    date: mediaDate,
  };
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

const formatPlaybackTime = (seconds) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

const playerControlButtonClass = 'flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/70 bg-white text-zinc-900 shadow-md transition hover:-translate-y-0.5 hover:bg-orange-50 active:translate-y-0 active:scale-95';

const MediaVideoPlayer = ({ src, poster }) => {
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
      const playerIsFullscreen = fullscreenElement === playerRef.current;
      setIsFullscreen(playerIsFullscreen);
      if (!playerIsFullscreen) setRotation(0);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!playing || !controlsVisible) return undefined;
    const timer = window.setTimeout(() => setControlsVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [playing, controlsVisible]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  };

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    const video = videoRef.current;
    if (!player || !video) return;

    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      await exitFullscreen?.call(document);
      return;
    }

    const requestFullscreen = player.requestFullscreen || player.webkitRequestFullscreen;
    if (requestFullscreen) {
      await requestFullscreen.call(player);
    } else {
      video.webkitEnterFullscreen?.();
    }
  };

  const rotateVideo = async () => {
    const player = playerRef.current;
    const video = videoRef.current;
    if (!player || !video) return;

    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement !== player) {
      const requestFullscreen = player.requestFullscreen || player.webkitRequestFullscreen;
      if (requestFullscreen) {
        await requestFullscreen.call(player);
      } else {
        video.webkitEnterFullscreen?.();
      }
    }
    setRotation((value) => (value + 90) % 360);
  };

  const isSideways = rotation % 180 !== 0;

  return (
    <div
      ref={playerRef}
      className={`relative w-full overflow-hidden bg-black ${isFullscreen ? 'flex h-screen items-center justify-center' : 'self-center'}`}
      onMouseMove={() => setControlsVisible(true)}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false);
      }}
      onTouchStart={() => setControlsVisible(true)}
    >
      <div className={`flex w-full items-center justify-center bg-black ${isFullscreen ? 'h-full' : ''}`}>
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          onPlay={() => {
            setPlaying(true);
            setControlsVisible(true);
          }}
          onPause={() => {
            setPlaying(false);
            setControlsVisible(true);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          className={`${isFullscreen ? 'h-full w-full' : 'max-h-[70vh] max-w-full'} object-contain`}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 200ms ease',
            ...(isFullscreen && isSideways ? {
              width: '100dvh',
              height: '100dvw',
              maxWidth: '100dvh',
              maxHeight: '100dvw',
            } : {}),
          }}
        />
      </div>
      <div className={`absolute inset-x-2 bottom-1.5 flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-zinc-950/75 px-2.5 text-white shadow-2xl backdrop-blur-md transition-all duration-300 sm:inset-x-3 sm:px-3 ${
        controlsVisible || !playing ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}>
        <button type="button" onClick={togglePlayback} className={playerControlButtonClass} aria-label={playing ? '일시정지' : '재생'}><Icon icon={playing ? 'mdi:pause' : 'mdi:play'} className="text-xl" /></button>
        <span className="hidden whitespace-nowrap text-xs font-medium tabular-nums text-white/80 sm:inline">
          {formatPlaybackTime(currentTime)} <span className="text-white/35">/</span> {formatPlaybackTime(duration)}
        </span>
        <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { if (videoRef.current) videoRef.current.currentTime = Number(event.target.value); }} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary" aria-label="재생 위치" />
        <button type="button" onClick={() => setMuted((value) => !value)} className={playerControlButtonClass} aria-label={muted ? '소리 켜기' : '음소거'}><Icon icon={muted ? 'mdi:volume-off' : 'mdi:volume-high'} className="text-xl" /></button>
        <button type="button" onClick={rotateVideo} className={playerControlButtonClass} aria-label="화면을 오른쪽으로 90도 회전"><Icon icon="mdi:rotate-right" className="text-xl" /></button>
        <button type="button" onClick={toggleFullscreen} className={playerControlButtonClass} aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면'}><Icon icon={isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'} className="text-xl" /></button>
      </div>
    </div>
  );
};

const PhotoLightbox = ({ src, alt, onClose, onPrevious, onNext }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const swipeRef = useRef(null);

  const applyScale = useCallback((nextScale) => {
    const normalizedScale = Math.min(5, Math.max(1, nextScale));
    setScale(normalizedScale);
    if (normalizedScale === 1) setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') applyScale(scale + 0.5);
      if (event.key === '-') applyScale(scale - 0.5);
      if (scale === 1 && event.key === 'ArrowLeft') onPrevious?.();
      if (scale === 1 && event.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [applyScale, onClose, onNext, onPrevious, scale]);

  const getPointerDistance = () => {
    const points = [...pointersRef.current.values()];
    return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      swipeRef.current = null;
      gestureRef.current = { distance: getPointerDistance(), scale };
    } else {
      swipeRef.current = scale === 1
        ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
      gestureRef.current = { x: event.clientX, y: event.clientY, offset };
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const distance = getPointerDistance();
      if (gestureRef.current?.distance) applyScale(gestureRef.current.scale * (distance / gestureRef.current.distance));
    } else if (scale > 1 && gestureRef.current?.x !== undefined) {
      setOffset({
        x: gestureRef.current.offset.x + event.clientX - gestureRef.current.x,
        y: gestureRef.current.offset.y + event.clientY - gestureRef.current.y,
      });
    }
  };

  const handlePointerEnd = (event) => {
    const swipe = swipeRef.current;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const point = [...pointersRef.current.values()][0];
      gestureRef.current = { x: point.x, y: point.y, offset };
    } else if (pointersRef.current.size === 0) {
      gestureRef.current = null;
    }
    if (swipe?.pointerId === event.pointerId && scale === 1) {
      const deltaX = event.clientX - swipe.x;
      const deltaY = event.clientY - swipe.y;
      if (Math.abs(deltaX) >= 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) onNext?.();
        else onPrevious?.();
      }
    }
    swipeRef.current = null;
  };

  const handlePointerCancel = (event) => {
    pointersRef.current.delete(event.pointerId);
    gestureRef.current = null;
    swipeRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/95" role="dialog" aria-modal="true" aria-label="사진 크게 보기">
      <button type="button" onClick={onClose} className="absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur hover:bg-white/25" aria-label="사진 크게 보기 닫기">
        <Icon icon="mdi:close" />
      </button>
      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 p-2 text-white backdrop-blur">
        <button type="button" onClick={() => applyScale(scale - 0.5)} disabled={scale <= 1} className="flex size-10 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-35" aria-label="축소"><Icon icon="mdi:minus" /></button>
        <span className="w-14 text-center text-sm font-bold tabular-nums">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => applyScale(scale + 0.5)} disabled={scale >= 5} className="flex size-10 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-35" aria-label="확대"><Icon icon="mdi:plus" /></button>
        <button type="button" onClick={() => applyScale(1)} className="flex size-10 items-center justify-center rounded-full hover:bg-white/15" aria-label="원래 크기"><Icon icon="mdi:restore" /></button>
      </div>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden touch-none ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
        onWheel={(event) => {
          event.preventDefault();
          applyScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
        }}
        onDoubleClick={() => applyScale(scale > 1 ? 1 : 2)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
      >
        <img
          src={src}
          alt={alt}
          draggable="false"
          className="max-h-full max-w-full select-none object-contain will-change-transform"
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
        />
      </div>
    </div>
  );
};

const MediaViewerPage = () => {
  const { mediaId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const commentsRef = useRef(null);
  const commentScrollHandledRef = useRef('');
  const tagSavingRef = useRef(false);
  const { user, isLiked, toggleLikeLocal, markWatchedLocal } = useAuth();
  const [mediaItems, setMediaItems] = useState([]);
  const [details, setDetails] = useState(null);
  const [child, setChild] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionDeleteOpen, setDescriptionDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [sharedWith, setSharedWith] = useState(['dad', 'mom']);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [uploadSuccessOpen, setUploadSuccessOpen] = useState(Boolean(location.state?.uploadSuccessMessage));
  const [photoOpen, setPhotoOpen] = useState(false);

  const requestedDate = searchParams.get('date');
  const focusComments = searchParams.get('focus') === 'comments';
  const requestedReturnTo = location.state?.returnTo;
  const returnTo = requestedReturnTo === '/album'
    || requestedReturnTo?.startsWith('/my-album/')
    || requestedReturnTo?.startsWith('/calendar?month=')
    ? requestedReturnTo
    : '/calendar';
  const albumMediaIds = location.state?.albumMediaIds;
  const current = mediaItems.find((item) => item.id === mediaId);
  const isYoutubeShort = current?.source === 'youtube'
    && (current.videoType === 'short' || current.src?.includes('/shorts/'));
  const date = requestedDate || current?.date;
  const items = useMemo(() => {
    if (Array.isArray(albumMediaIds)) {
      const byId = new Map(mediaItems.map((item) => [item.id, item]));
      return albumMediaIds.map((id) => byId.get(id)).filter(Boolean);
    }
    return mediaItems.filter((item) => item.date === date);
  }, [albumMediaIds, date, mediaItems]);
  const currentIndex = items.findIndex((item) => item.id === mediaId);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  const removeToast = useCallback((id) => {
    setToasts((value) => value.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((type, message) => {
    setToasts([{
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
    }]);
  }, []);

  useEffect(() => {
    setToasts([]);
  }, [mediaId]);

  const loadDetails = useCallback(() => getMediaDetails(mediaId, user?.id)
    .then((data) => {
      setDetails(data);
      setSharedWith(data.sharedWith?.length ? data.sharedWith : ['dad', 'mom']);
    })
    .catch((loadError) => showToast('error', loadError.message)), [mediaId, showToast, user?.id]);

  useEffect(() => {
    setLoading(true);
    const loadMediaItems = Array.isArray(albumMediaIds) && albumMediaIds.length > 0
      ? getAllVideos({ ids: albumMediaIds.join(',') })
      : requestedDate
        ? getAllVideos({ uploadedAt: requestedDate })
        : getVideoById(mediaId).then((item) => [item]);
    Promise.all([
      loadMediaItems.then((allMedia) => setMediaItems(allMedia.map(toMemoryMedia))),
      loadDetails(),
    ]).finally(() => setLoading(false));
  }, [albumMediaIds, loadDetails, mediaId, requestedDate, user?.id]);

  useEffect(() => {
    getChildProfile()
      .then(setChild)
      .catch((profileError) => console.error('아이 정보 조회 실패:', profileError));
  }, []);

  useEffect(() => {
    if (!focusComments) {
      commentScrollHandledRef.current = '';
      return undefined;
    }
    if (loading || !commentsRef.current) return undefined;
    const scrollKey = `${mediaId}:comments`;
    if (commentScrollHandledRef.current === scrollKey) return undefined;
    commentScrollHandledRef.current = scrollKey;
    const timer = window.setTimeout(() => {
      commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [focusComments, loading, mediaId]);

  useEffect(() => {
    if (!current) return;
    setEditDate(current.date || '');
    setDescriptionDraft(current.description || '');
    setEditingDescription(false);
  }, [current]);

  useEffect(() => {
    if (current?.processingStatus !== 'processing') return undefined;
    let active = true;
    const refreshProcessingMedia = () => getVideoById(mediaId)
      .then((item) => {
        if (!active) return;
        const mapped = toMemoryMedia(item);
        setMediaItems((itemsValue) => itemsValue.map((media) => media.id === mapped.id ? mapped : media));
      })
      .catch(() => {});
    const intervalId = window.setInterval(refreshProcessingMedia, 2500);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [current?.processingStatus, mediaId]);

  useEffect(() => {
    if (!current || !user || user.watchedVideos?.includes(current.id)) return;
    markVideoWatched(user.id, current.id)
      .then(async () => {
        markWatchedLocal(current.id);
        await dismissMediaNotifications([current.id]);
        return loadDetails();
      })
      .catch((watchError) => console.error('시청 기록 추가 실패:', watchError));
  }, [current, loadDetails, markWatchedLocal, user]);

  const moveTo = (item) => {
    if (item) navigate(`/media/${item.id}?date=${date}`, { state: { returnTo, albumMediaIds } });
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft' && previous) moveTo(previous);
      if (event.key === 'ArrowRight' && next) moveTo(next);
      if (event.key === 'Escape') {
        if (photoOpen) setPhotoOpen(false);
        else if (editing) setEditing(false);
        else if (returnTo.startsWith('/my-album/')) navigate(returnTo, { replace: true });
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
      showToast('error', actionError.message);
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
      showToast('error', actionError.message);
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
    if (!tag || current.tags?.includes(tag)) {
      setTagDraft('');
      setAddingTag(false);
      return;
    }
    tagSavingRef.current = true;
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, {
        tags: [...(current.tags || []), tag],
      }, user?.id));
      setMediaItems((value) => value.map((item) => item.id === mediaId ? saved : item));
      setTagDraft('');
      setAddingTag(false);
      window.dispatchEvent(new Event('hotube:media-updated'));
      showToast('success', '태그를 추가했습니다.');
    } catch (tagError) {
      showToast('error', tagError.message);
    } finally {
      tagSavingRef.current = false;
    }
  };

  const removeTag = async (tag) => {
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, {
        tags: (current.tags || []).filter((item) => item !== tag),
      }, user?.id));
      setMediaItems((value) => value.map((item) => item.id === mediaId ? saved : item));
      window.dispatchEvent(new Event('hotube:media-updated'));
      showToast('success', '태그를 삭제했습니다.');
    } catch (tagError) {
      showToast('error', tagError.message);
    }
  };

  const saveDescription = async () => {
    if (busyAction) return;
    setBusyAction('description');
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, {
        description: descriptionDraft.trim(),
      }, user?.id));
      setMediaItems((value) => value.map((item) => item.id === mediaId ? saved : item));
      setDescriptionDraft(saved.description || '');
      setEditingDescription(false);
      window.dispatchEvent(new Event('hotube:media-updated'));
      showToast('success', '한줄기록을 저장했습니다.');
    } catch (actionError) {
      showToast('error', actionError.message);
    } finally {
      setBusyAction('');
    }
  };

  const deleteDescription = async () => {
    if (busyAction) return;
    setBusyAction('description-delete');
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, { description: '' }, user?.id));
      setMediaItems((value) => value.map((item) => item.id === mediaId ? saved : item));
      setDescriptionDraft('');
      setEditingDescription(false);
      setDescriptionDeleteOpen(false);
      window.dispatchEvent(new Event('hotube:media-updated'));
      showToast('success', '한줄기록을 삭제했습니다.');
    } catch (actionError) {
      showToast('error', actionError.message);
    } finally {
      setBusyAction('');
    }
  };

  const saveMetadata = async () => {
    if (!editDate || sharedWith.length === 0) {
      showToast('warning', '날짜와 공유할 가족을 한 명 이상 선택해 주세요.');
      return;
    }
    setBusyAction('save');
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, { uploadedAt: editDate, sharedWith }));
      setMediaItems((value) => value.map((item) => item.id === mediaId ? saved : item));
      setDetails((value) => ({ ...value, sharedWith }));
      setEditing(false);
      showToast('success', '미디어 정보를 저장했습니다.');
      window.dispatchEvent(new Event('hotube:media-updated'));
      if (editDate !== date) navigate(`/media/${mediaId}?date=${editDate}`, { replace: true, state: { returnTo } });
    } catch (actionError) {
      showToast('error', actionError.message);
    } finally {
      setBusyAction('');
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteVideo(mediaId, user?.id);
      window.dispatchEvent(new Event('hotube:media-updated'));
      navigate(returnTo.startsWith('/my-album/') ? returnTo : `/calendar/${date}`, { replace: true, state: { returnTo } });
    } catch (actionError) {
      showToast('error', actionError.message);
    }
  };

  const shareLabel = ['dad', 'mom'].every((category) => sharedWith.includes(category))
    ? '모든가족'
    : sharedWith.map((category) => ({ dad: '아빠가족', mom: '엄마가족', etc: '기타' })[category]).filter(Boolean).join(' · ');

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

  const childDay = formatChildDay(child?.birthday, current.date);

  return (
    <main className="min-h-screen bg-background pb-16 text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {returnTo.startsWith('/my-album/') ? (
            <button
              type="button"
              onClick={() => navigate(returnTo, { replace: true })}
              className="flex size-10 items-center justify-center rounded-full hover:bg-primary/10"
              aria-label="내 앨범 상세로 돌아가기"
            >
              <Icon icon="mdi:arrow-left" className="text-2xl" />
            </button>
          ) : (
            <Link to={`/calendar/${date}`} state={{ returnTo }} className="flex size-10 items-center justify-center rounded-full hover:bg-primary/10" aria-label="날짜 앨범으로 돌아가기">
              <Icon icon="mdi:arrow-left" className="text-2xl" />
            </Link>
          )}
          <div className="text-center">
            <p className="text-base font-bold tabular-nums">{current.date}</p>
            <p className="text-xs text-text-secondary">{currentIndex + 1} / {items.length}</p>
          </div>
          {details?.canModify ? (
            <button type="button" onClick={() => setEditing((value) => !value)} className="flex size-10 items-center justify-center rounded-full hover:bg-primary/10" aria-label="미디어 정보 수정">
              <Icon icon="mdi:dots-horizontal" className="text-2xl" />
            </button>
          ) : <span className="size-10" />}
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
        <div className="min-w-0">
          <section className="overflow-hidden rounded-2xl bg-surface shadow-sm">
            {childDay.day && (
              <div className="flex justify-center bg-surface px-4 py-2.5">
                <span className="rounded-full bg-background px-4 py-1 text-sm font-bold text-text-secondary">
                  {childDay.day}
                </span>
              </div>
            )}
            <div className={`relative flex items-center justify-center border-b border-border bg-white ${current.type === 'photo' ? '' : 'min-h-[48vh] sm:min-h-[65vh]'}`}>
              {current.processingStatus === 'processing' ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <Icon icon="mdi:movie-open-cog-outline" className="text-6xl text-primary" />
                  <p className="mt-4 text-lg font-bold">영상을 준비하고 있어요</p>
                  <p className="mt-1 text-sm text-text-secondary">완료되면 이 화면에서 자동으로 재생됩니다.</p>
                  <Icon icon="mdi:loading" className="mt-5 animate-spin text-2xl text-primary" />
                </div>
              ) : current.processingStatus === 'failed' ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <Icon icon="mdi:alert-circle-outline" className="text-6xl text-error" />
                  <p className="mt-4 text-lg font-bold">영상을 처리하지 못했어요</p>
                  <p className="mt-1 text-sm text-text-secondary">관리자에게 문의하거나 영상을 다시 올려주세요.</p>
                </div>
              ) : current.source === 'youtube' ? (
                <div className={`flex w-full justify-center bg-black ${isYoutubeShort ? 'py-2 sm:py-4' : ''}`}>
                  <iframe
                    src={`https://www.youtube.com/embed/${extractVideoId(current.src)}?autoplay=1&mute=0&playsinline=1`}
                    title={current.title}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className={isYoutubeShort
                      ? 'aspect-[9/16] h-[70vh] max-h-[800px] max-w-full bg-black'
                      : 'aspect-video w-full'}
                  />
                </div>
              ) : current.type === 'video' ? (
                <MediaVideoPlayer key={current.id} src={current.src} poster={current.thumbnail} />
              ) : (
                <button type="button" onClick={() => setPhotoOpen(true)} className="group relative flex w-full cursor-zoom-in items-center justify-center" aria-label={`${current.title} 크게 보기`}>
                  <img src={current.src} alt={current.title} className="block max-h-[75vh] w-full object-contain" />
                  <span className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-black/55 text-xl text-white opacity-90 shadow-lg backdrop-blur transition group-hover:scale-105" aria-hidden="true"><Icon icon="mdi:magnify-plus-outline" /></span>
                </button>
              )}
              <button type="button" onClick={() => moveTo(previous)} disabled={!previous} className="absolute left-3 flex size-11 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md disabled:hidden" aria-label="이전 미디어"><Icon icon="mdi:chevron-left" /></button>
              <button type="button" onClick={() => moveTo(next)} disabled={!next} className="absolute right-3 flex size-11 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md disabled:hidden" aria-label="다음 미디어"><Icon icon="mdi:chevron-right" /></button>
            </div>

            <div className="px-5 pb-3 pt-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {current.source === 'youtube' && (
                  <h1 className="truncate text-xl font-bold sm:text-2xl">{current.title}</h1>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                {details?.viewers?.length > 0 && (
                  <span className="flex -space-x-1">{details.viewers.slice(0, 6).map((viewer) => <FamilyAvatar key={viewer.id} person={viewer} className="size-6" />)}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex items-center gap-1 font-semibold"><Icon icon="mdi:account-group-outline" />{shareLabel}</span>
                <span>·</span>
                <span>by {details?.uploader?.title || details?.uploader?.name || '가족'}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <ActionButton icon={isLiked(mediaId) ? 'mdi:heart' : 'mdi:heart-outline'} label="좋아요" count={details?.likeCount || 0} active={isLiked(mediaId)} onClick={handleLike} />
              <ActionButton icon={details?.favorited ? 'mdi:bookmark' : 'mdi:bookmark-outline'} label="즐겨찾기" active={details?.favorited} onClick={handleFavorite} />
              <ActionButton icon="mdi:comment-outline" label="댓글" count={details?.commentCount || 0} onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
              <ActionButton icon="mdi:download-outline" label="다운로드" href={current.source === 'file' && current.src ? `${current.src}&download=1` : undefined} disabled={current.source !== 'file' || !current.src} />
            </div>

            {(current.description || details?.canModify) && <div className="mt-3 border-t border-border pt-3">
              {editingDescription ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-bold">한줄기록</span>
                    <span className="text-[11px] text-text-secondary">{descriptionDraft.length}/5000</span>
                  </div>
                  <textarea
                    autoFocus
                    value={descriptionDraft}
                    onChange={(event) => setDescriptionDraft(event.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder="이 순간을 기억할 한마디를 남겨보세요."
                    className="w-full resize-y rounded-xl border-border bg-background px-3 py-2.5 text-sm leading-6 focus:border-primary focus:ring-primary/30"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => { setDescriptionDraft(current.description || ''); setEditingDescription(false); }} disabled={busyAction === 'description'} className="rounded-lg px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-background disabled:opacity-50">취소</button>
                    <button type="button" onClick={saveDescription} disabled={busyAction === 'description'} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busyAction === 'description' ? '저장 중…' : '저장'}</button>
                  </div>
                </div>
              ) : current.description ? (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">한줄기록</span>
                    {details?.canModify && (
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => { setDescriptionDraft(current.description || ''); setEditingDescription(true); }} className="p-0.5 text-text-secondary transition hover:text-primary" aria-label="한줄기록 수정">
                          <Icon icon="mdi:pencil-outline" className="text-sm" />
                        </button>
                        <button type="button" onClick={() => setDescriptionDeleteOpen(true)} className="p-0.5 text-text-secondary transition hover:text-error" aria-label="한줄기록 삭제">
                          <Icon icon="mdi:delete-outline" className="text-sm" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">{current.description}</p>
                </div>
              ) : details?.canModify ? (
                <button type="button" onClick={() => { setDescriptionDraft(''); setEditingDescription(true); }} className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:opacity-70">
                  <Icon icon="mdi:text-box-plus-outline" className="text-base" />
                  한줄기록
                </button>
              ) : null}
            </div>}

            <div className="mt-2 flex min-h-6 flex-wrap items-center gap-1.5 text-xs">
              {[...new Set(current.tags || [])].map((tag) => (
                <span key={tag} className="inline-flex items-center gap-0.5 text-text-secondary">
                  #{tag}
                  {details?.canModify && <button type="button" onClick={() => removeTag(tag)} className="rounded-full p-0.5 hover:bg-error/10 hover:text-error" aria-label={`${tag} 태그 삭제`}><Icon icon="mdi:close" className="text-xs" /></button>}
                </span>
              ))}
              {details?.canModify && (addingTag ? (
                <form onSubmit={submitTag} className="flex items-center gap-1">
                  <input autoFocus value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onBlur={submitTag} onKeyDown={(event) => { if (event.key === 'Escape') { setTagDraft(''); setAddingTag(false); } }} placeholder="태그" className="h-6 w-24 rounded-full border-primary bg-surface px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary" />
                </form>
              ) : (
                <button type="button" onClick={() => setAddingTag(true)} className="font-semibold text-primary hover:underline">+ 태그</button>
              ))}
            </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div ref={commentsRef} id="comments">
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
          <section className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" aria-labelledby="media-edit-title">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="media-edit-title" className="text-lg font-bold">미디어 수정</h2>
                <p className="mt-0.5 text-xs text-text-secondary">날짜와 공유 가족을 변경할 수 있어요.</p>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10" aria-label="닫기"><Icon icon="mdi:close" className="text-xl" /></button>
            </div>
            <div className="mt-5">
              <DatePickerField
                label="날짜"
                value={editDate}
                onChange={setEditDate}
                placeholder="날짜를 선택하세요"
              />
            </div>
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

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {photoOpen && current.type === 'photo' && (
        <PhotoLightbox
          src={current.src}
          alt={current.title}
          onClose={() => setPhotoOpen(false)}
          onPrevious={previous ? () => {
            if (previous.type !== 'photo') setPhotoOpen(false);
            moveTo(previous);
          } : undefined}
          onNext={next ? () => {
            if (next.type !== 'photo') setPhotoOpen(false);
            moveTo(next);
          } : undefined}
        />
      )}
      <Modal
        isOpen={uploadSuccessOpen}
        onClose={() => setUploadSuccessOpen(false)}
        title="업로드 완료"
        message={location.state?.uploadSuccessMessage || '미디어가 업로드되었습니다.'}
        confirmText="확인"
      />
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={confirmDelete} title="미디어 삭제" message="이 사진 또는 영상을 삭제할까요? 삭제한 파일은 복구할 수 없습니다." type="confirm" confirmText="삭제" />
      <Modal isOpen={descriptionDeleteOpen} onClose={() => setDescriptionDeleteOpen(false)} onConfirm={deleteDescription} title="한줄기록 삭제" message="이 한줄기록을 삭제할까요?" type="confirm" confirmText="삭제" cancelText="취소" />
    </main>
  );
};

export default MediaViewerPage;
