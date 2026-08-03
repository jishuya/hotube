import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DayPicker } from '@daypicker/react';
import { ko } from '@daypicker/react/locale/ko';
import '@daypicker/react/style.css';
import Header from '../components/common/Header';
import { getAllVideos, toMemoryMedia } from '../services/videoApi';
import { useAuth } from '../contexts/AuthContext';
import { DayPickerDropdown } from '../components/common/CustomSelect';

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

const parseMonthKey = (value) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) return null;
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
};

const formatMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const CalendarDayButton = ({ day, modifiers, className, ...buttonProps }) => {
  const dateKey = formatDateKey(day.date);
  const hasMedia = Boolean(modifiers.hasMedia);
  const isUnread = Boolean(modifiers.unread);

  return (
    <button
      {...buttonProps}
      className={`${className || ''} calendar-memory-day ${hasMedia ? 'calendar-memory-day--has-media' : ''}`}
      data-has-media={hasMedia ? 'true' : undefined}
      aria-label={`${dateKey}, 미디어 ${hasMedia ? '있음' : '없음'}${isUnread ? ', 새 미디어' : ''}`}
    >
      <span>{day.date.getDate()}</span>
      {isUnread && <span className="calendar-memory-new">N</span>}
    </button>
  );
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const monthParam = searchParams.get('month');
  const month = useMemo(() => parseMonthKey(monthParam) || new Date(), [monthParam]);
  const [mediaItems, setMediaItems] = useState([]);
  const selectedMonth = formatMonthKey(month);
  const mediaByDate = useMemo(() => mediaItems.reduce((groups, item) => {
    if (item.date) {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
    }
    return groups;
  }, {}), [mediaItems]);
  const unreadDates = Object.keys(mediaByDate)
    .filter((date) => date.startsWith(selectedMonth)
      && mediaByDate[date].some((item) => !user?.watchedVideos?.includes(item.id)))
    .sort((a, b) => b.localeCompare(a));

  useEffect(() => {
    const loadMedia = () => getAllVideos()
      .then((items) => setMediaItems(items.map(toMemoryMedia)))
      .catch((error) => console.error('캘린더 미디어 조회 실패:', error));
    loadMedia();
    window.addEventListener('hotube:media-updated', loadMedia);
    return () => window.removeEventListener('hotube:media-updated', loadMedia);
  }, []);

  const handleMonthChange = (nextMonth) => {
    setSearchParams({ month: formatMonthKey(nextMonth) }, { replace: true });
  };

  const openDate = (date) => {
    const dateKey = formatDateKey(date);
    navigate(`/calendar/${dateKey}`, {
      state: { returnTo: `/calendar?month=${dateKey.slice(0, 7)}` },
    });
  };

  return (
    <>
      <Header showSearch={false} showChildBanner />
      <main className="min-h-screen bg-background px-4 pt-2 text-text-primary">
        <div className="mx-auto max-w-3xl">
        <section className="rounded-xl bg-surface p-3 shadow-sm sm:p-5" aria-label="추억 달력">
          <DayPicker
            locale={ko}
            month={month}
            onMonthChange={handleMonthChange}
            onDayClick={openDate}
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2035, 11)}
            captionLayout="dropdown"
            reverseYears
            showOutsideDays
            fixedWeeks
            modifiers={{
              hasMedia: Object.keys(mediaByDate).map(parseDateKey),
              unread: unreadDates.map(parseDateKey),
            }}
            components={{ DayButton: CalendarDayButton, Dropdown: DayPickerDropdown }}
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
                        state={{ returnTo: `/calendar?month=${date.slice(0, 7)}` }}
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
                          state={{ returnTo: `/calendar?month=${date.slice(0, 7)}` }}
                          className={`group relative min-w-0 overflow-hidden rounded-lg bg-black/5 ${index === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'}`}
                          aria-label={item.title}
                        >
                          {item.type === 'video' && !item.thumbnail ? (
                            <video src={item.src} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          ) : (
                            <img src={item.thumbnail || item.src} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          )}
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
