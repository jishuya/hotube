import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

          <RecentMediaFeed returnTo={`/calendar?month=${selectedMonth}`} />
      </div>
    </main>
    </>
  );
};

export default CalendarPage;
