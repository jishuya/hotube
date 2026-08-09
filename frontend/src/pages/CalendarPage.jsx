import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DayPicker } from '@daypicker/react';
import { ko } from '@daypicker/react/locale/ko';
import '@daypicker/react/style.css';
import Header from '../components/common/Header';
import { getCalendarMedia, toMemoryMedia } from '../services/videoApi';
import { DayPickerDropdown } from '../components/common/CustomSelect';

const formatRecentDate = (dateString) => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric', weekday: 'short',
}).format(new Date(`${dateString}T00:00:00`));

const formatUploadTime = (createdAt) => {
  if (!createdAt) return '';
  const uploaded = new Date(createdAt);
  const elapsed = Date.now() - uploaded.getTime();
  if (elapsed < 60 * 60 * 1000) return '방금 업로드';
  if (elapsed < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(elapsed / (60 * 60 * 1000)))}시간 전 업로드`;
  if (elapsed < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / (24 * 60 * 60 * 1000))}일 전 업로드`;
  return `${new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(uploaded)} 업로드`;
};

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
  const monthParam = searchParams.get('month');
  const month = useMemo(() => parseMonthKey(monthParam) || new Date(), [monthParam]);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaDates, setMediaDates] = useState([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const selectedMonth = formatMonthKey(month);
  const unreadDates = [...new Set(mediaItems
    .map((item) => item.date)
    .filter((date) => date?.startsWith(selectedMonth)))]
    .sort((a, b) => b.localeCompare(a));
  const recentActivity = useMemo(() => Object.entries(mediaItems
    .reduce((groups, item) => {
      if (!item.date) return groups;
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
      return groups;
    }, {}))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
      latestCreatedAt: items.reduce((latest, item) => (
        !latest || new Date(item.createdAt || 0) > new Date(latest) ? item.createdAt : latest
      ), null),
    }))
    .sort((a, b) => new Date(b.latestCreatedAt || 0) - new Date(a.latestCreatedAt || 0)), [mediaItems]);
  const visibleRecentActivity = showAllRecent ? recentActivity : recentActivity.slice(0, 3);

  useEffect(() => {
    const loadMedia = () => getCalendarMedia()
      .then(({ dates, unreadMedia }) => {
        setMediaDates(dates);
        setMediaItems(unreadMedia.map(toMemoryMedia));
      })
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
              hasMedia: mediaDates.map(parseDateKey),
              unread: unreadDates.map(parseDateKey),
            }}
            components={{ DayButton: CalendarDayButton, Dropdown: DayPickerDropdown }}
            className="memory-calendar"
          />
        </section>

          <section className="mt-8" aria-labelledby="recent-media-title">
            <h2 id="recent-media-title" className="mb-4 text-xl font-bold">최근 활동</h2>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {visibleRecentActivity.map(({ date, items, latestCreatedAt }) => (
                  <article key={date} className="rounded-xl bg-surface p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold">새 사진·영상 {items.length}개가 올라왔어요</h3>
                        <p className="mt-0.5 truncate text-xs text-text-secondary">촬영일 {formatRecentDate(date)} · {formatUploadTime(latestCreatedAt)}</p>
                      </div>
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
                      {items.slice(0, 5).map((item, index) => (
                        <Link
                          key={item.id}
                          to={`/media/${item.id}?date=${date}`}
                          state={{ returnTo: `/calendar?month=${date.slice(0, 7)}` }}
                          className={`group relative min-w-0 overflow-hidden rounded-lg bg-black/5 ${index === 0 ? 'col-span-2 row-span-2 aspect-square' : 'aspect-square'}`}
                          aria-label={item.title}
                        >
                          {item.type === 'video' && !item.thumbnail ? (
                            <video src={item.src} preload="none" muted playsInline className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          ) : (
                            <img src={item.thumbnail || item.src} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
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
                {recentActivity.length > 3 && (
                  <button type="button" onClick={() => setShowAllRecent((current) => !current)} className="flex w-full items-center justify-center gap-1 rounded-xl py-3 text-sm font-bold text-primary transition hover:bg-primary/10">
                    {showAllRecent ? '접기' : `최근 활동 전체 보기 (${recentActivity.length})`}
                    <Icon icon={showAllRecent ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="text-lg" />
                  </button>
                )}
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
