import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useLocation } from 'react-router-dom';
import { getMediaPage, toMemoryMedia } from '../../services/videoApi';
import { toggleLike } from '../../services/authApi';
import { useAuth } from '../../contexts/AuthContext';

const PAGE_SIZE = 12;

// Measure each tile so new pages append without redistributing earlier photos.
function RecentMediaTile({ item, returnTo }) {
  const { user, isLiked, toggleLikeLocal } = useAuth();
  const [pendingLiked, setPendingLiked] = useState(null);
  const [likeError, setLikeError] = useState('');
  const savingLike = useRef(false);
  const latestToggleLikeLocal = useRef(toggleLikeLocal);
  const liked = pendingLiked ?? isLiked(item.id);

  useEffect(() => {
    latestToggleLikeLocal.current = toggleLikeLocal;
  }, [toggleLikeLocal]);

  const handleLike = async () => {
    if (!user || savingLike.current) return;
    savingLike.current = true;
    setLikeError('');
    setPendingLiked(!liked);
    try {
      await toggleLike(user.id, item.id);
      latestToggleLikeLocal.current(item.id);
    } catch {
      setLikeError('좋아요를 저장하지 못했어요. 다시 눌러주세요.');
    } finally {
      savingLike.current = false;
      setPendingLiked(null);
    }
  };
  const contentRef = useRef(null);
  const [rowSpan, setRowSpan] = useState(50);
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setRowSpan(Math.ceil((content.getBoundingClientRect().height + 12) / 4));
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
          <article style={{ gridRowEnd: `span ${rowSpan}` }} className="relative min-w-0 self-start">
            <Link
              ref={contentRef}
              to={`/media/${item.id}${item.date ? `?date=${item.date}` : ''}`}
              state={{ returnTo: `${returnTo}#recent-media-title` }}
              className="group block overflow-hidden rounded-2xl bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={item.title || (item.type === 'video' ? '영상 보기' : '사진 보기')}
            >
              <div className="relative overflow-hidden bg-black/5">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt={item.title || ''} loading="lazy" decoding="async" onLoad={(event) => setAspectRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight || 1)} style={{ aspectRatio }} className="block h-auto w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-text-secondary">
                    <Icon icon="mdi:image-outline" className="text-4xl" />
                  </div>
                )}
                {item.type === 'video' && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm">
                    <Icon icon="mdi:play" className="text-lg" />
                  </span>
                )}
              </div>
            </Link>
            <button
              type="button"
              onClick={handleLike}
              disabled={!user || pendingLiked !== null}
              aria-label={liked ? '좋아요 취소' : '좋아요'}
              aria-pressed={liked}
              className="absolute bottom-0 right-0 flex size-11 items-center justify-center rounded-full text-white transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait"
            >
              <Icon icon={liked ? 'mdi:heart' : 'mdi:heart-outline'} className={`text-base ${liked ? 'text-rose-400' : ''}`} aria-hidden="true" />
            </button>
            {likeError && <p role="alert" className="absolute bottom-14 left-2 right-2 rounded-lg bg-black/80 p-2 text-xs text-white">{likeError}</p>}
          </article>
  );
}

export default function RecentMediaFeed({ returnTo }) {
  const location = useLocation();

  useEffect(() => {
    if (location.hash !== '#recent-media-title') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('recent-media-title')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.hash]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinel = useRef(null);
  const request = useRef({ generation: 0, loading: false, cursor: null, hasMore: true });

  const loadPage = useCallback(async (reset = false) => {
    const state = request.current;
    if (reset) {
      state.generation += 1;
      state.cursor = null;
      state.hasMore = true;
      state.loading = false;
      setItems([]);
      setHasMore(true);
    }
    if (state.loading || !state.hasMore) return;
    const generation = state.generation;
    state.loading = true;
    setLoading(true);
    setError(false);
    try {
      const page = await getMediaPage({ limit: PAGE_SIZE, source: 'file' }, state.cursor);
      if (generation !== request.current.generation) return;
      const incoming = page.items.map(toMemoryMedia);
      setItems((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...incoming.filter((item) => !seen.has(item.id))];
      });
      state.cursor = page.nextCursor;
      state.hasMore = Boolean(page.nextCursor);
      setHasMore(state.hasMore);
    } catch {
      if (generation === request.current.generation) setError(true);
    } finally {
      if (generation === request.current.generation) {
        state.loading = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const refresh = () => { void loadPage(true); };
    refresh();
    window.addEventListener('hotube:media-updated', refresh);
    const state = request.current;
    return () => {
      state.generation += 1;
      window.removeEventListener('hotube:media-updated', refresh);
    };
  }, [loadPage]);

  useEffect(() => {
    if (loading || error || !hasMore || !sentinel.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadPage();
    }, { rootMargin: '200px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loading, error, hasMore, loadPage]);

  return (
    <section className="mt-8 pb-8" aria-labelledby="recent-media-title" aria-busy={loading}>
      <h2 id="recent-media-title" className="mb-4 scroll-mt-24 text-xl font-bold">최근 활동</h2>
      <div className="grid auto-rows-[4px] grid-cols-2 gap-x-3 sm:grid-cols-3">
        {items.map((item) => (
          <RecentMediaTile key={item.id} item={item} returnTo={returnTo} />
        ))}
      </div>
      <div ref={sentinel} className="mt-4 text-center text-sm text-text-secondary" aria-live="polite">
        {loading ? <p className="py-4">사진과 영상을 불러오는 중이에요…</p> : error ? (
          <div className="py-4">
            <p>사진과 영상을 불러오지 못했어요.</p>
            <button type="button" onClick={() => loadPage()} className="mt-2 rounded-lg px-4 py-2 font-bold text-primary hover:bg-primary/10">다시 시도</button>
          </div>
        ) : hasMore ? (
          <button type="button" onClick={() => loadPage()} className="w-full rounded-xl py-3 font-bold text-primary hover:bg-primary/10">더 불러오기</button>
        ) : <p className="py-4">{items.length ? '모든 사진과 영상을 확인했어요.' : '아직 업로드된 사진이나 영상이 없어요.'}</p>}
      </div>
    </section>
  );
}
