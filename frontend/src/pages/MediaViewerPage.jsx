import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getMediaByDate, memoryMedia } from '../data/memoryMedia';
import { markMemoryDateAsViewed } from '../utils/viewedMemoryDates';
import { markMediaAsViewed } from '../utils/viewedMedia';

const MediaViewerPage = () => {
  const { mediaId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedDate = searchParams.get('date');
  const current = memoryMedia.find((item) => item.id === mediaId);
  const date = requestedDate || current?.date;
  const items = getMediaByDate(date);
  const currentIndex = items.findIndex((item) => item.id === mediaId);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  useEffect(() => {
    if (current && date) {
      markMemoryDateAsViewed(date);
      markMediaAsViewed(current.id);
    }
  }, [current, date]);

  const moveTo = (item) => {
    if (item) navigate(`/media/${item.id}?date=${date}`);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft' && previous) moveTo(previous);
      if (event.key === 'ArrowRight' && next) moveTo(next);
      if (event.key === 'Escape') navigate(`/calendar/${date}`);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!current) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-white">
        <Icon icon="mdi:image-off-outline" className="mb-4 text-6xl text-white/40" />
        <h1 className="text-xl font-bold">미디어를 찾을 수 없어요.</h1>
        <Link to="/calendar" className="mt-5 rounded-full bg-primary px-5 py-2.5 font-semibold">캘린더로 돌아가기</Link>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-zinc-950 text-white">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4 sm:p-6">
        <Link
          to={`/calendar/${date}`}
          aria-label="날짜 앨범으로 돌아가기"
          className="flex size-11 items-center justify-center rounded-full bg-black/35 backdrop-blur hover:bg-black/60"
        >
          <Icon icon="mdi:close" className="text-2xl" />
        </Link>
        <p className="rounded-full bg-black/35 px-4 py-2 text-sm font-semibold backdrop-blur">
          {currentIndex + 1} / {items.length}
        </p>
      </header>

      <section className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden px-3 py-24 sm:px-20">
        {current.type === 'video' ? (
          <video
            key={current.id}
            src={current.src}
            poster={current.thumbnail}
            controls
            autoPlay
            className="max-h-[72vh] max-w-full rounded-lg object-contain shadow-2xl"
          >
            사용 중인 브라우저가 영상 재생을 지원하지 않습니다.
          </video>
        ) : (
          <img
            key={current.id}
            src={current.src}
            alt={current.title}
            className="max-h-[72vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        )}

        <button
          type="button"
          onClick={() => moveTo(previous)}
          disabled={!previous}
          aria-label="이전 미디어"
          className="absolute left-3 flex size-12 items-center justify-center rounded-full bg-black/45 text-3xl backdrop-blur transition hover:bg-primary disabled:pointer-events-none disabled:opacity-20 sm:left-6 sm:size-14"
        >
          <Icon icon="mdi:chevron-left" />
        </button>
        <button
          type="button"
          onClick={() => moveTo(next)}
          disabled={!next}
          aria-label="다음 미디어"
          className="absolute right-3 flex size-12 items-center justify-center rounded-full bg-black/45 text-3xl backdrop-blur transition hover:bg-primary disabled:pointer-events-none disabled:opacity-20 sm:right-6 sm:size-14"
        >
          <Icon icon="mdi:chevron-right" />
        </button>
      </section>

      <footer className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-5 pb-6 pt-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/65">
            <Icon icon={current.type === 'video' ? 'mdi:video-outline' : 'mdi:image-outline'} className="text-lg" />
            <span>{current.type === 'video' ? '영상' : '사진'}</span>
            <span>·</span>
            <span>{current.date}</span>
          </div>
          <h1 className="text-xl font-bold sm:text-2xl">{current.title}</h1>
          <p className="mt-1 text-sm text-white/70">{current.description}</p>
        </div>
      </footer>
    </main>
  );
};

export default MediaViewerPage;
