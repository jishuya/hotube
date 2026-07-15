import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import { memoryMedia } from '../data/memoryMedia';
import { getViewedMemoryDates } from '../utils/viewedMemoryDates';

const year = 2026;
const month = 6;
const daysInMonth = new Date(year, month + 1, 0).getDate();
const startDay = new Date(year, month, 1).getDay();
const mediaCountByDate = memoryMedia.reduce((counts, item) => {
  counts[item.date] = (counts[item.date] || 0) + 1;
  return counts;
}, {});

const mediaByDate = memoryMedia.reduce((groups, item) => {
  if (!groups[item.date]) groups[item.date] = [];
  groups[item.date].push(item);
  return groups;
}, {});

const formatRecentDate = (dateString) => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'short',
}).format(new Date(`${dateString}T00:00:00`));

const CalendarPage = () => {
  const viewedDates = getViewedMemoryDates();
  const unreadDates = Object.keys(mediaByDate)
    .filter((date) => !viewedDates.includes(date))
    .sort((a, b) => b.localeCompare(a));

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background px-4 pb-16 pt-6 text-text-primary">
        <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold">2026년 7월</h1>
          </div>
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon icon="mdi:calendar-month-outline" className="text-2xl" />
          </div>
        </div>

        <section className="rounded-xl bg-surface p-3 shadow-sm sm:p-5" aria-label="2026년 7월 캘린더">
          <div className="mb-3 grid grid-cols-7 text-center text-sm font-bold text-text-secondary sm:text-base">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
              <span key={day} className={index === 0 ? 'text-error' : ''}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: startDay }).map((_, index) => <div key={`empty-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
              const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = mediaCountByDate[date] || 0;
              const isUnread = count > 0 && !viewedDates.includes(date);
              return (
                <Link
                  key={date}
                  to={`/calendar/${date}`}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-full text-base font-semibold transition active:scale-95 sm:text-lg ${count ? 'bg-primary text-white shadow-sm hover:bg-primary/90' : 'hover:bg-primary/10'}`}
                  aria-label={`${date}, 미디어 ${count}개`}
                >
                  <span>{day}</span>
                  {isUnread && (
                    <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-error text-[9px] font-black leading-none text-white shadow-sm sm:right-1 sm:top-1 sm:size-5 sm:text-[10px]">
                      N
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>

          <section className="mt-8" aria-labelledby="recent-media-title">
            <h2 id="recent-media-title" className="mb-4 text-xl font-bold">최근 활동</h2>
            {unreadDates.length > 0 ? (
              <div className="space-y-4">
                {unreadDates.map((date) => (
                  <article key={date} className="rounded-xl bg-surface p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="font-bold">{formatRecentDate(date)}</h3>
                      <Link
                        to={`/calendar/${date}`}
                        className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-primary hover:underline"
                      >
                        더보기
                        <Icon icon="mdi:chevron-right" className="text-lg" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-4 grid-rows-2 gap-2">
                      {mediaByDate[date].slice(0, 5).map((item, index) => (
                        <Link
                          key={item.id}
                          to={`/media/${item.id}?date=${date}`}
                          className={`group relative min-w-0 overflow-hidden rounded-lg bg-black/5 ${index === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'}`}
                          aria-label={item.title}
                        >
                          <img
                            src={item.thumbnail || item.src}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {item.type === 'video' && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                              <Icon icon="mdi:play-circle" className="text-3xl text-white drop-shadow sm:text-4xl" />
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-surface px-4 py-10 text-center text-sm text-text-secondary shadow-sm">
                새로 확인할 사진이나 영상이 없어요.
              </div>
            )}
          </section>
      </div>
    </main>
    </>
  );
};

export default CalendarPage;
