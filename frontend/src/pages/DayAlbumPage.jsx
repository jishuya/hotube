import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/common/Header';
import { getMediaByDate } from '../data/memoryMedia';
import { markMemoryDateAsViewed } from '../utils/viewedMemoryDates';

const formatDate = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(date);
};

const DayAlbumPage = () => {
  const { date } = useParams();
  const navigate = useNavigate();
  const media = getMediaByDate(date);

  useEffect(() => {
    if (media.length > 0) markMemoryDateAsViewed(date);
  }, [date, media.length]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background px-4 pb-32 pt-6 text-text-primary">
        <div className="mx-auto max-w-container">
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="mb-5 flex items-center gap-1 text-sm font-semibold text-text-secondary hover:text-primary"
          >
            <Icon icon="mdi:chevron-left" className="text-xl" />
            캘린더로 돌아가기
          </button>

          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-1 text-sm font-semibold text-primary">기억 앨범</p>
              <h1 className="text-2xl font-bold sm:text-3xl">{formatDate(date)}</h1>
            </div>
          </div>

          {media.length > 0 ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="해당 날의 사진과 영상">
              {media.map((item) => (
                <Link
                  key={item.id}
                  to={`/media/${item.id}?date=${date}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-surface shadow-sm"
                >
                  <img
                    src={item.thumbnail || item.src}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      {item.type === 'video' && <Icon icon="mdi:play-circle" className="shrink-0 text-2xl" />}
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          ) : (
            <section className="flex min-h-[45vh] flex-col items-center justify-center rounded-xl bg-surface text-center shadow-sm">
              <Icon icon="mdi:image-off-outline" className="mb-3 text-5xl text-primary/40" />
              <h2 className="text-lg font-bold">아직 기록이 없어요</h2>
              <p className="mt-2 text-sm text-text-secondary">이 날의 사진이나 영상을 업로드해 보세요.</p>
              <Link to="/upload" className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">업로드하기</Link>
            </section>
          )}
        </div>
      </main>
    </>
  );
};

export default DayAlbumPage;
