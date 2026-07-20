import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/common/Header';
import { getMediaByDate } from '../data/memoryMedia';
import { markMemoryDateAsViewed } from '../utils/viewedMemoryDates';
import { getViewedMediaIds } from '../utils/viewedMedia';

const parseDate = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const DayAlbumPage = () => {
  const { date } = useParams();
  const navigate = useNavigate();
  const media = getMediaByDate(date);
  const viewedMediaIds = getViewedMediaIds();

  const moveDate = (amount) => {
    const currentDate = parseDate(date);
    if (!currentDate) return;
    currentDate.setDate(currentDate.getDate() + amount);
    navigate(`/calendar/${formatDateKey(currentDate)}`);
  };

  useEffect(() => {
    if (media.length > 0) markMemoryDateAsViewed(date);
  }, [date, media.length]);

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background pb-16 text-text-primary">
        <div className="border-b border-border bg-surface">
          <div className="mx-auto grid h-16 max-w-container grid-cols-[44px_1fr_44px] items-center px-4 sm:h-20">
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="flex size-11 items-center justify-center rounded-full text-text-primary transition hover:bg-primary/10 hover:text-primary active:scale-95"
            aria-label="캘린더로 돌아가기"
            title="캘린더로 돌아가기"
          >
            <Icon icon="mdi:arrow-left" className="text-3xl" />
          </button>

          <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-5">
            <button
              type="button"
              onClick={() => moveDate(-1)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-text-secondary transition hover:bg-primary/15 hover:text-primary active:scale-95 sm:size-11"
              aria-label="이전 날짜"
              title="이전 날짜"
            >
              <Icon icon="mdi:chevron-left" className="text-2xl" />
            </button>

            <h1 className="truncate text-center text-xl font-extrabold tracking-tight sm:text-3xl">{date}</h1>

            <button
              type="button"
              onClick={() => moveDate(1)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-text-secondary transition hover:bg-primary/15 hover:text-primary active:scale-95 sm:size-11"
              aria-label="다음 날짜"
              title="다음 날짜"
            >
              <Icon icon="mdi:chevron-right" className="text-2xl" />
            </button>
          </div>
          <span aria-hidden="true" />
          </div>
        </div>

        <div className="mx-auto max-w-container px-4 pt-6">
          {media.length > 0 ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="해당 날의 사진과 영상">
              {media.map((item) => (
                <Link
                  key={item.id}
                  to={`/media/${item.id}?date=${date}`}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-surface shadow-sm"
                >
                  {!viewedMediaIds.includes(item.id) && (
                    <span className="absolute right-2 top-2 z-[1] flex size-5 items-center justify-center rounded-full bg-error text-[10px] font-black text-white shadow-md">
                      N
                    </span>
                  )}
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
            <section className="flex min-h-[58vh] flex-col items-center justify-center px-4 text-center">
              <Icon icon="mdi:archive-outline" className="mb-5 text-7xl text-text-secondary/65" />
              <h2 className="text-xl font-bold text-text-secondary">아직 기록이 없어요</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
                이 날의 사진이나 영상을 업로드해 보세요.
              </p>
              <Link to="/upload" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90 active:scale-95">기록 추가하기</Link>
            </section>
          )}
        </div>
      </main>
    </>
  );
};

export default DayAlbumPage;
