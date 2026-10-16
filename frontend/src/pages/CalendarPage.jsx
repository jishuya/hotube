import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { DayPicker } from '@daypicker/react';
import { ko } from '@daypicker/react/locale/ko';
import '@daypicker/react/style.css';
import Header from '../components/common/Header';
import { getCalendarMedia, toMemoryMedia } from '../services/videoApi';
import RecentMediaFeed from '../components/common/RecentMediaFeed';
import { DayPickerDropdown } from '../components/common/CustomSelect';

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
  const calendarRef = useRef(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const calendarBottom = calendarRef.current?.getBoundingClientRect().bottom;
      setShowScrollToTop(window.scrollY >= 600 || (window.scrollY > 160 && calendarBottom <= 96));
    };
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const month = useMemo(() => parseMonthKey(monthParam) || new Date(), [monthParam]);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaDates, setMediaDates] = useState([]);
  const selectedMonth = formatMonthKey(month);
  const unreadDates = [...new Set(mediaItems
    .map((item) => item.date)
    .filter((date) => date?.startsWith(selectedMonth)))]
    .sort((a, b) => b.localeCompare(a));
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
        <section ref={calendarRef} className="rounded-xl bg-surface p-3 shadow-sm sm:p-5" aria-label="추억 달력">
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

          <RecentMediaFeed returnTo={`/calendar?month=${selectedMonth}`} />
      </div>
    </main>
      {showScrollToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="맨 위로 이동"
          title="맨 위로"
          className="fixed right-4 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:right-6"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Icon icon="mdi:arrow-up" className="text-2xl" aria-hidden="true" />
        </button>
      )}
    </>
  );
};

export default CalendarPage;
