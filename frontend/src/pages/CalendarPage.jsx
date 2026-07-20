import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate } from 'react-router-dom';
import { DayPicker } from '@daypicker/react';
import { ko } from '@daypicker/react/locale/ko';
import '@daypicker/react/style.css';
import Header from '../components/common/Header';
import { memoryMedia } from '../data/memoryMedia';
import { getViewedMemoryDates } from '../utils/viewedMemoryDates';

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

const formatDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const parseDateKey = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const CalendarDayButton = ({ day, modifiers, className, ...buttonProps }) => {
  const dateKey = formatDateKey(day.date);
  const mediaCount = mediaCountByDate[dateKey] || 0;

  return (
    <button
      {...buttonProps}
      className={`${className || ''} calendar-memory-day ${mediaCount ? 'calendar-memory-day--has-media' : ''}`}
      aria-label={`${dateKey}, 미디어 ${mediaCount}개`}
    >
      <span>{day.date.getDate()}</span>
      {modifiers.unread && <span className="calendar-memory-new">N</span>}
    </button>
  );
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date(2026, 6, 1));
  const selectedMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const viewedDates = getViewedMemoryDates();
  const unreadDates = Object.keys(mediaByDate)
    .filter((date) => date.startsWith(selectedMonth) && !viewedDates.includes(date))
    .sort((a, b) => b.localeCompare(a));

  return (
    <>
      <Header showSearch={false} showChildBanner />
      <main className="min-h-screen bg-background px-4 pt-2 text-text-primary">
        <div className="mx-auto max-w-3xl">
        <section className="rounded-xl bg-surface p-3 shadow-sm sm:p-5" aria-label="추억 달력">
          <DayPicker
            locale={ko}
            month={month}
            onMonthChange={setMonth}
            onDayClick={(date) => navigate(`/calendar/${formatDateKey(date)}`)}
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2035, 11)}
            captionLayout="dropdown"
            reverseYears
            showOutsideDays
            fixedWeeks
            modifiers={{ unread: unreadDates.map(parseDateKey) }}
            components={{ DayButton: CalendarDayButton }}
            className="memory-calendar"
          />
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
