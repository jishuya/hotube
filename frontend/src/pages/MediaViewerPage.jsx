import MediaDescription from '../components/common/MediaDescription';
import { parseTags } from '../utils/tags';
import { getMediaCaption, parseCaption, removeCaptionTag } from '../utils/caption';
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

const ActionButton = ({ icon, label, active = false, count, onClick, href, disabled = false }) => {
  const className = `flex min-h-10 min-w-12 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
    active ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-primary/10 hover:text-primary'
  } ${disabled ? 'pointer-events-none opacity-40' : ''}`;
  const content = (
    <>
      <Icon icon={icon} className="text-2xl" />
      <span className="whitespace-nowrap">{label}{count !== undefined ? ` ${count}` : ''}</span>
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

const MediaVideoPlayer = ({ src, poster, onPrevious, onNext, isFullscreen, onFullscreenChange }) => {
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const swipeRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [videoSize, setVideoSize] = useState({ width: 16, height: 9 });
  const [renderedVideoWidth, setRenderedVideoWidth] = useState(0);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const updateViewportSize = () => setViewportSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, [isFullscreen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const updateRenderedVideoWidth = () => {
      setRenderedVideoWidth(video.getBoundingClientRect().width);
    };
    const resizeObserver = new ResizeObserver(updateRenderedVideoWidth);
    resizeObserver.observe(video);
    updateRenderedVideoWidth();
    return () => resizeObserver.disconnect();
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

  const toggleFullscreen = () => {
    setRotation(0);
    onFullscreenChange?.(!isFullscreen);
  };

  const rotateVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!isFullscreen) onFullscreenChange?.(true);
    setRotation((value) => (value + 90) % 360);
  };

  const isSideways = rotation % 180 !== 0;
  const fullscreenLayout = useMemo(() => {
    const sourceRatio = videoSize.width / videoSize.height;
    const availableWidth = Math.max(1, isSideways
      ? viewportSize.height
      : viewportSize.width);
    const availableHeight = Math.max(1, isSideways
      ? viewportSize.width
      : viewportSize.height);
    const width = Math.min(availableWidth, availableHeight * sourceRatio);

    return {
      videoWidth: width,
      videoHeight: width / sourceRatio,
    };
  }, [isSideways, videoSize, viewportSize]);

  return (
    <div
      ref={playerRef}
      className={`flex w-full flex-col items-center overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100] h-[100dvh] bg-black' : 'relative self-center bg-transparent'}`}
      onMouseMove={() => setControlsVisible(true)}
      onMouseLeave={() => {
        if (playing) setControlsVisible(false);
      }}
      onTouchStart={() => setControlsVisible(true)}
      onPointerDown={(event) => {
        if (!isFullscreen || event.target.closest('button, input')) return;
        swipeRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        const swipe = swipeRef.current;
        swipeRef.current = null;
        if (!swipe || swipe.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - swipe.x;
        const deltaY = event.clientY - swipe.y;
        if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
        if (deltaX < 0) onNext?.();
        else onPrevious?.();
      }}
      onPointerCancel={() => { swipeRef.current = null; }}
      style={isFullscreen ? { touchAction: 'none' } : undefined}
    >
      <div
        className={isFullscreen ? 'absolute left-1/2 top-1/2' : 'contents'}
        style={isFullscreen ? {
          width: fullscreenLayout.videoWidth,
          height: fullscreenLayout.videoHeight,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transition: 'transform 200ms ease',
        } : undefined}
      >
        <div className={`relative flex items-center justify-center ${isFullscreen ? 'h-full w-full bg-black' : 'w-full bg-transparent'}`}>
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted={muted}
            playsInline
            preload="metadata"
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
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight } = event.currentTarget;
              if (videoWidth && videoHeight) setVideoSize({ width: videoWidth, height: videoHeight });
              setPlaying(false);
              setCurrentTime(0);
              setDuration(event.currentTarget.duration || 0);
              setRotation(0);
              setControlsVisible(true);
            }}
            className={`${isFullscreen ? 'h-full w-full' : 'max-h-[70vh] max-w-full'} object-contain`}
          />
          {!playing && currentTime === 0 && (
            <button
              type="button"
              onClick={togglePlayback}
              className="absolute inset-0 z-10 m-auto flex size-16 items-center justify-center rounded-full bg-black/65 text-4xl text-white shadow-xl backdrop-blur-sm transition hover:scale-105 hover:bg-black/75"
              aria-label="영상 재생"
            >
              <Icon icon="mdi:play" />
            </button>
          )}
        </div>
        <div
          className={`flex h-11 items-center gap-2 rounded-xl px-2.5 text-white transition-all duration-300 sm:px-3 ${
            isFullscreen
              ? 'absolute inset-x-0 bottom-0 z-20 bg-transparent shadow-none'
              : 'relative shrink-0 border border-zinc-200 bg-zinc-100/90 shadow-sm'
          } ${
            controlsVisible || !playing ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          style={isFullscreen ? undefined : { width: renderedVideoWidth || 'calc(100% - 1rem)' }}
        >
          <button type="button" onClick={togglePlayback} className={playerControlButtonClass} aria-label={playing ? '일시정지' : '재생'}><Icon icon={playing ? 'mdi:pause' : 'mdi:play'} className="text-xl" /></button>
          <span className={`hidden whitespace-nowrap text-xs font-medium tabular-nums sm:inline ${isFullscreen ? 'text-white/80' : 'text-zinc-600'}`}>
            {formatPlaybackTime(currentTime)} <span className={isFullscreen ? 'text-white/35' : 'text-zinc-400'}>/</span> {formatPlaybackTime(duration)}
          </span>
          <input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={(event) => { if (videoRef.current) videoRef.current.currentTime = Number(event.target.value); }} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary" aria-label="재생 위치" />
          <button type="button" onClick={() => setMuted((value) => !value)} className={playerControlButtonClass} aria-label={muted ? '소리 켜기' : '음소거'}><Icon icon={muted ? 'mdi:volume-off' : 'mdi:volume-high'} className="text-xl" /></button>
          <button type="button" onClick={rotateVideo} className={playerControlButtonClass} aria-label="화면을 오른쪽으로 90도 회전"><Icon icon="mdi:rotate-right" className="text-xl" /></button>
          <button type="button" onClick={toggleFullscreen} className={playerControlButtonClass} aria-label={isFullscreen ? '전체 화면 종료' : '전체 화면'}><Icon icon={isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'} className="text-xl" /></button>
        </div>
      </div>
      {isFullscreen && onPrevious && (
        <button type="button" onClick={onPrevious} className="absolute left-3 top-1/2 z-30 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-3xl text-white shadow-lg backdrop-blur-sm hover:bg-black/65" aria-label="이전 미디어">
          <Icon icon="mdi:chevron-left" />
        </button>
      )}
      {isFullscreen && onNext && (
        <button type="button" onClick={onNext} className="absolute right-3 top-1/2 z-30 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-3xl text-white shadow-lg backdrop-blur-sm hover:bg-black/65" aria-label="다음 미디어">
          <Icon icon="mdi:chevron-right" />
        </button>
      )}
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
      {onPrevious && scale === 1 && (
        <button type="button" onClick={onPrevious} className="absolute left-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-3xl text-white shadow-lg backdrop-blur-sm hover:bg-black/65" aria-label="이전 미디어">
          <Icon icon="mdi:chevron-left" />
        </button>
      )}
      {onNext && scale === 1 && (
        <button type="button" onClick={onNext} className="absolute right-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-3xl text-white shadow-lg backdrop-blur-sm hover:bg-black/65" aria-label="다음 미디어">
          <Icon icon="mdi:chevron-right" />
        </button>
      )}
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
  const detailSwipeRef = useRef(null);
  const suppressDetailClickRef = useRef(false);
  const internalMediaNavigationRef = useRef(false);
  const commentScrollHandledRef = useRef('');
  const detailsRequestRef = useRef(0);
  const { user, isLiked, toggleLikeLocal, markWatchedLocal } = useAuth();
  const [mediaItems, setMediaItems] = useState([]);
  const [details, setDetails] = useState(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [descriptionTags, setDescriptionTags] = useState([]);
  const [tagDraft, setTagDraft] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const resetDescriptionDraft = useCallback((media) => {
    const parsed = parseCaption(getMediaCaption(media));
    setDescriptionDraft(parsed.parts.filter((part) => !part.tag).map((part) => part.text).join('').trim());
    setDescriptionTags(parsed.tags);
    setTagDraft('');
    setAddingTag(false);
  }, []);
  const addDraftTags = () => {
    setDescriptionTags((tags) => [...new Set([...tags, ...parseTags(tagDraft)])]);
    setTagDraft('');
    setAddingTag(false);
  };
  const [descriptionDeleteOpen, setDescriptionDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [sharedWith, setSharedWith] = useState(['dad', 'mom']);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [uploadSuccessOpen, setUploadSuccessOpen] = useState(Boolean(location.state?.uploadSuccessMessage));
  const [viewerOpen, setViewerOpen] = useState(false);

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
  const caption = getMediaCaption(current);
  const parsedCaption = parseCaption(caption);
  const visibleDescription = parsedCaption.parts.filter((part) => !part.tag).map((part) => part.text).join('').trim();
  const visibleTags = parsedCaption.tags;
  const descriptionLength = descriptionDraft.length;
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

  useEffect(() => {
    if (!viewerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [viewerOpen]);

  const loadDetails = useCallback((force = false) => {
    const requestId = detailsRequestRef.current + 1;
    detailsRequestRef.current = requestId;
    return getMediaDetails(mediaId, user?.id, { force })
    .then((data) => {
      if (detailsRequestRef.current !== requestId) return;
      setDetails(data);
      setSharedWith(Array.isArray(data.sharedWith) ? data.sharedWith : ['dad', 'mom']);
    })
    .catch((loadError) => {
      if (detailsRequestRef.current === requestId) showToast('error', loadError.message);
    });
  }, [mediaId, showToast, user?.id]);

  const handleCommentCountChange = useCallback((commentCount) => {
    setDetails((value) => {
      if (!value || value.commentCount === commentCount) return value;
      return { ...value, commentCount };
    });
  }, []);

  useEffect(() => {
    let active = true;
    const preserveCurrentViewer = internalMediaNavigationRef.current;
    internalMediaNavigationRef.current = false;
    if (!preserveCurrentViewer) setLoading(true);
    setDetails(null);
    const loadMediaItems = Array.isArray(albumMediaIds) && albumMediaIds.length > 0
      ? getAllVideos({ ids: albumMediaIds.join(',') })
      : requestedDate
        ? getAllVideos({ uploadedAt: requestedDate })
        : getVideoById(mediaId).then((item) => [item]);
    loadMediaItems
      .then((allMedia) => {
        if (active) setMediaItems(allMedia.map(toMemoryMedia));
      })
      .catch((loadError) => {
        if (active) showToast('error', loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void loadDetails();
    return () => {
      active = false;
    };
  }, [albumMediaIds, loadDetails, mediaId, requestedDate, showToast]);

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
    resetDescriptionDraft(current);
    setEditingDescription(false);
  }, [current, resetDescriptionDraft]);

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
    if (!current) return undefined;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return undefined;
    const resources = [];
    const preload = () => {
      [previous, next].filter(Boolean).forEach((item) => {
        const imageUrl = item.type === 'photo'
          ? item.preview || item.thumbnail
          : item.thumbnail;
        if (imageUrl) {
          const image = new Image();
          image.decoding = 'async';
          image.src = imageUrl;
          resources.push(image);
        }
        if (item === next && item.type === 'video' && item.source === 'file' && item.src) {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.src = item.src;
          resources.push(video);
        }
      });
    };
    const timer = window.setTimeout(preload, 400);
    return () => {
      window.clearTimeout(timer);
      resources.forEach((resource) => {
        if (resource instanceof HTMLVideoElement) {
          resource.removeAttribute('src');
          resource.load();
        } else {
          resource.src = '';
        }
      });
    };
  }, [current, next, previous]);

  useEffect(() => {
    if (!current || !user || user.watchedVideos?.includes(current.id)) return;
    markVideoWatched(user.id, current.id)
      .then(async () => {
        markWatchedLocal(current.id);
        await dismissMediaNotifications([current.id]);
        return loadDetails(true);
      })
      .catch((watchError) => console.error('시청 기록 추가 실패:', watchError));
  }, [current, loadDetails, markWatchedLocal, user]);

  const moveTo = (item) => {
    if (!item) return;
    internalMediaNavigationRef.current = true;
    navigate(`/media/${item.id}?date=${date}`, { state: { returnTo, albumMediaIds } });
  };

  const handleDetailPointerDown = (event) => {
    if (event.target.closest('input, iframe')) return;
    detailSwipeRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDetailPointerUp = (event) => {
    const swipe = detailSwipeRef.current;
    detailSwipeRef.current = null;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - swipe.x;
    const deltaY = event.clientY - swipe.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const destination = deltaX < 0 ? next : previous;
    if (!destination) return;
    suppressDetailClickRef.current = true;
    moveTo(destination);
    window.setTimeout(() => { suppressDetailClickRef.current = false; }, 0);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const photoViewerHandlesArrows = viewerOpen && current?.type === 'photo';
      if (!photoViewerHandlesArrows && event.key === 'ArrowLeft' && previous) moveTo(previous);
      if (!photoViewerHandlesArrows && event.key === 'ArrowRight' && next) moveTo(next);
      if (event.key === 'Escape') {
        if (viewerOpen) setViewerOpen(false);
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

  const removeTag = async (tag) => {
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, {
        description: removeCaptionTag(current.description, tag),
        tags: parseCaption(removeCaptionTag(getMediaCaption(current), tag)).tags,
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
    if (descriptionDraft.length > 500) {
      showToast('error', '태그를 제외한 설명은 500자 이내로 작성해주세요.');
      return;
    }
    setBusyAction('description');
    try {
      const saved = toMemoryMedia(await updateVideo(mediaId, {
        description: descriptionDraft.trim(),
        tags: [...new Set([...descriptionTags, ...parseTags(tagDraft)])],
      }, user?.id));
      setMediaItems((value) => value.map((item) => item.id === mediaId ? saved : item));
      resetDescriptionDraft(saved);
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
    if (!editDate || (sharedWith.length === 0 && !['admin', 'sub-admin'].includes(user?.role))) {
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

  const descriptionLabel = current?.type === 'photo' ? '사진 설명' : '영상 설명';

  const shareLabel = sharedWith.length === 0 ? '부부' : ['dad', 'mom'].every((category) => sharedWith.includes(category))
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
            <Link to={`/calendar/${current.date}`} state={{ returnTo }} className="rounded px-2 py-1 text-base font-bold tabular-nums transition hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={`${current.date} 날짜 앨범으로 이동`}>{current.date}</Link>
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
            <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-text-secondary">
              <div className="flex min-w-0 items-center -space-x-1" aria-label="사진·영상을 본 가족">
                {details?.viewers?.slice(0, 6).map((viewer) => <FamilyAvatar key={viewer.id} person={viewer} className="size-6" />)}
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="inline-flex shrink-0 items-center gap-1 font-semibold"><Icon icon="mdi:account-group-outline" aria-hidden="true" />{shareLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{details?.uploader?.title || details?.uploader?.name || '가족'} 올림</span>
              </div>
            </div>
            <div
              className="relative flex touch-pan-y items-center justify-center border-b border-border bg-white"
              onPointerDown={handleDetailPointerDown}
              onPointerUp={handleDetailPointerUp}
              onPointerCancel={() => { detailSwipeRef.current = null; }}
              onClickCapture={(event) => {
                if (!suppressDetailClickRef.current) return;
                event.preventDefault();
                event.stopPropagation();
              }}
            >
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
                <MediaVideoPlayer
                  src={current.src}
                  poster={current.thumbnail}
                  isFullscreen={viewerOpen}
                  onFullscreenChange={setViewerOpen}
                  onPrevious={previous ? () => moveTo(previous) : undefined}
                  onNext={next ? () => moveTo(next) : undefined}
                />
              ) : (
                <button type="button" onClick={() => setViewerOpen(true)} className="group relative flex w-full cursor-zoom-in items-center justify-center" aria-label={`${current.title} 크게 보기`}>
                  <img
                    src={current.preview || current.thumbnail || current.src}
                    alt={current.title}
                    decoding="async"
                    className="block max-h-[75vh] w-full object-contain"
                  />
                  <span className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-black/55 text-xl text-white opacity-90 shadow-lg backdrop-blur transition group-hover:scale-105" aria-hidden="true"><Icon icon="mdi:magnify-plus-outline" /></span>
                </button>
              )}
              <button type="button" onClick={() => moveTo(previous)} disabled={!previous} className="absolute left-3 flex size-11 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md disabled:hidden" aria-label="이전 미디어"><Icon icon="mdi:chevron-left" /></button>
              <button type="button" onClick={() => moveTo(next)} disabled={!next} className="absolute right-3 flex size-11 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md disabled:hidden" aria-label="다음 미디어"><Icon icon="mdi:chevron-right" /></button>
            </div>

            {details?.canModify && (
              <div className="mx-4 mb-1 mt-3 flex items-center justify-between gap-2">
                <button type="button" onClick={() => { resetDescriptionDraft(current); setEditingDescription((value) => !value); }} disabled={Boolean(busyAction)} aria-expanded={editingDescription} aria-controls="media-description-input" className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-primary disabled:opacity-50">
                  <Icon icon="mdi:pencil-box-outline" className="text-base" aria-hidden="true" />
                  {descriptionLabel}
                </button>
                {editingDescription && (
                  <div className="flex items-center gap-2">
                    {current.description && (
                      <button type="button" onClick={() => setDescriptionDeleteOpen(true)} disabled={Boolean(busyAction)} className="flex size-5 items-center justify-center rounded-full text-text-secondary transition hover:bg-error/10 hover:text-error disabled:opacity-50" aria-label={`${descriptionLabel} 삭제`} title="설명 삭제">
                        <Icon icon="mdi:close" className="text-lg" />
                      </button>
                    )}
                    <span className="text-[11px] leading-none text-text-secondary">{descriptionLength}/500</span>
                  </div>
                )}
              </div>
            )}

            {(caption.trim() || editingDescription) && <section aria-label={descriptionLabel} className={`px-4 pb-1 text-sm ${editingDescription || details?.canModify ? 'pt-0' : 'pt-3'}`}>
              {editingDescription ? (
                <div>
                  <textarea
                    id="media-description-input"
                    autoFocus
                    aria-label={descriptionLabel}
                    value={descriptionDraft}
                    onChange={(event) => setDescriptionDraft(event.target.value)}
                    rows={2}
                    placeholder="이 순간을 남겨보세요."
                    maxLength={500}
                    aria-invalid={descriptionLength > 500}
                    className="block w-full resize-y rounded-lg border-border bg-background px-2 py-1.5 text-sm leading-5 focus:border-primary focus:ring-primary/30"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-secondary">
                    {descriptionTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-0.5">
                        #{tag}
                        <button type="button" disabled={Boolean(busyAction)} onClick={() => setDescriptionTags((tags) => tags.filter((item) => item !== tag))} className="rounded-full p-0.5 hover:bg-error/10 hover:text-error" aria-label={`${tag} 태그 삭제`}><Icon icon="mdi:close" className="text-xs" /></button>
                      </span>
                    ))}
                    {addingTag ? (
                      <input autoFocus value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onBlur={addDraftTags}
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                          if (event.key === 'Enter') { event.preventDefault(); addDraftTags(); }
                          if (event.key === 'Escape') { setTagDraft(''); setAddingTag(false); }
                        }}
                        disabled={Boolean(busyAction)} aria-label="해시태그 추가" placeholder="#일상 #가족" className="h-6 w-40 rounded-full border-primary bg-surface px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary" />
                    ) : (
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => { setTagDraft('#'); setAddingTag(true); }} className="font-semibold hover:underline">+ 태그</button>
                    )}
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => { resetDescriptionDraft(current); setEditingDescription(false); }} disabled={busyAction === 'description'} className="rounded-lg px-3 py-1.5 text-xs font-bold text-text-secondary hover:bg-background disabled:opacity-50">취소</button>
                    <button type="button" onClick={saveDescription} disabled={busyAction === 'description' || descriptionLength > 500} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busyAction === 'description' ? '저장 중…' : '저장'}</button>
                  </div>
                </div>
              ) : caption ? (
                <div>
                  <MediaDescription
                    key={mediaId}
                    text={visibleDescription}
                    label={descriptionLabel}
                    onEdit={details?.canModify ? () => { resetDescriptionDraft(current); setEditingDescription(true); } : undefined}
                  />
                  {visibleTags.length > 0 && (
                    <div className={`${visibleDescription ? 'mt-1' : ''} flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-secondary`}>
                      {visibleTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-0.5">
                          {details?.canModify ? (
                            <button type="button" onClick={() => { resetDescriptionDraft(current); setEditingDescription(true); }} aria-label={`태그 ${tag} 수정`}>#{tag}</button>
                          ) : `#${tag}`}
                          {details?.canModify && <button type="button" onClick={() => removeTag(tag)} className="rounded-full p-0.5 hover:bg-error/10 hover:text-error" aria-label={`${tag} 태그 삭제`}><Icon icon="mdi:close" className="text-xs" /></button>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>}


            {current.source === 'youtube' && (
              <h1 className="mx-4 mt-1 truncate text-sm font-semibold">{current.title}</h1>
            )}

            <div className="grid grid-cols-4 items-start px-2 pb-2 pt-1">
              <ActionButton icon={isLiked(mediaId) ? 'mdi:heart' : 'mdi:heart-outline'} label="좋아요" count={details?.likeCount || 0} active={isLiked(mediaId)} onClick={handleLike} />
              <ActionButton icon={details?.favorited ? 'mdi:bookmark' : 'mdi:bookmark-outline'} label="즐겨찾기" active={details?.favorited} onClick={handleFavorite} />
              <ActionButton icon="mdi:comment-outline" label="댓글" count={details?.commentCount || 0} onClick={() => commentsRef.current?.scrollIntoView({ behavior: 'smooth' })} />
              <ActionButton icon="mdi:download-outline" label="다운로드" href={current.source === 'file' && current.src ? `${current.src}&download=1` : undefined} disabled={current.source !== 'file' || !current.src} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div ref={commentsRef} id="comments">
            <CommentSection
              videoId={mediaId}
              onCountChange={handleCommentCountChange}
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
              <div className={`mt-2 grid gap-1.5 ${['admin', 'sub-admin'].includes(user?.role) ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {['admin', 'sub-admin'].includes(user?.role) && <button type="button" onClick={() => setSharedWith([])} aria-pressed={sharedWith.length === 0} className={`min-h-10 whitespace-nowrap rounded-xl border px-1 py-1.5 text-xs font-bold sm:text-sm ${sharedWith.length === 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}><Icon icon={sharedWith.length === 0 ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="mr-1 inline" />부부</button>}
                {[['mom', '엄마가족'], ['dad', '아빠가족']].map(([value, label]) => <button key={value} type="button" onClick={() => toggleFamily(value)} className={`min-h-10 whitespace-nowrap rounded-xl border px-1 py-1.5 text-xs font-bold sm:text-sm ${sharedWith.includes(value) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}><Icon icon={sharedWith.includes(value) ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="mr-1 inline" />{label}</button>)}
              </div>
            </fieldset>
            <button type="button" onClick={saveMetadata} disabled={busyAction === 'save'} className="mt-5 h-11 w-full rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50">{busyAction === 'save' ? '저장 중...' : '변경사항 저장'}</button>
            <button type="button" onClick={() => { setEditing(false); setDeleteOpen(true); }} className="mt-2 h-10 w-full rounded-xl bg-error text-sm font-bold text-white transition hover:opacity-90"><Icon icon="mdi:delete-outline" className="mr-1 inline text-lg" />사진·영상 삭제</button>
          </section>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {viewerOpen && current.type === 'photo' && (
        <PhotoLightbox
          src={current.src}
          alt={current.title}
          onClose={() => setViewerOpen(false)}
          onPrevious={previous ? () => moveTo(previous) : undefined}
          onNext={next ? () => moveTo(next) : undefined}
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
