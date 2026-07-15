import { useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import { memoryMedia } from '../data/memoryMedia';
import { getViewedMediaIds } from '../utils/viewedMedia';
import { getDateAlbumTags, saveDateAlbumTags } from '../utils/dateAlbumTags';

const MONTH_COUNT = 18;
const BASE_YEAR = 2026;
const BASE_MONTH = 7;

const monthOptions = Array.from({ length: MONTH_COUNT }, (_, index) => {
  const date = new Date(BASE_YEAR, BASE_MONTH - 1 - index, 1);
  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
});

const formatDateTitle = (dateString) => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric',
}).format(new Date(`${dateString}T00:00:00`));

const formatWeekday = (dateString) => new Intl.DateTimeFormat('ko-KR', {
  weekday: 'long',
}).format(new Date(`${dateString}T00:00:00`));

const NewMediaBadge = () => (
  <span className="absolute right-2 top-2 z-[1] flex size-5 items-center justify-center rounded-full bg-error text-[10px] font-black text-white shadow-md">
    N
  </span>
);

const AlbumPage = () => {
  const monthBarRef = useRef(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState(monthOptions[0].key);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [collapsedDates, setCollapsedDates] = useState([]);
  const [dateTags, setDateTags] = useState(getDateAlbumTags);
  const [taggingDate, setTaggingDate] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const viewedMediaIds = getViewedMediaIds();

  const [selectedYear, selectedMonth] = selectedMonthKey.split('-').map(Number);

  const timeline = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = memoryMedia.filter((item) => item.date.startsWith(selectedMonthKey)
      && (mediaType === 'all' || item.type === mediaType)
      && (!normalizedQuery
        || item.title?.toLowerCase().includes(normalizedQuery)
        || item.description?.toLowerCase().includes(normalizedQuery)));

    return Object.entries(filtered.reduce((groups, item) => {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
      return groups;
    }, {})).sort(([a], [b]) => b.localeCompare(a));
  }, [selectedMonthKey, searchQuery, mediaType]);

  const selectMonth = (key) => {
    setSelectedMonthKey(key);
    setCollapsedDates([]);
  };

  const moveMonth = (direction) => {
    const currentIndex = monthOptions.findIndex((item) => item.key === selectedMonthKey);
    const nextIndex = Math.min(Math.max(currentIndex + direction, 0), monthOptions.length - 1);
    selectMonth(monthOptions[nextIndex].key);
    monthBarRef.current?.children[nextIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const toggleDate = (date) => {
    setCollapsedDates((current) => current.includes(date)
      ? current.filter((item) => item !== date)
      : [...current, date]);
  };

  const addTag = (date) => {
    const normalizedTag = tagDraft.trim().replace(/^#/, '');
    const currentTags = dateTags[date] || [];
    if (normalizedTag && !currentTags.includes(normalizedTag)) {
      setDateTags(saveDateAlbumTags(date, [...currentTags, normalizedTag]));
    }
    setTaggingDate(null);
    setTagDraft('');
  };

  const removeTag = (date, tag) => {
    const nextTags = (dateTags[date] || []).filter((item) => item !== tag);
    setDateTags(saveDateAlbumTags(date, nextTags));
  };

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background pb-16 text-text-primary">
        <section className="border-y border-border bg-surface/95 shadow-sm backdrop-blur" aria-label="월 선택">
          <div className="mx-auto flex max-w-4xl items-center px-2">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달" className="flex size-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10">
              <Icon icon="mdi:chevron-left" className="text-2xl" />
            </button>
            <div ref={monthBarRef} className="scrollbar-hide flex flex-1 snap-x gap-1 overflow-x-auto py-1.5">
              {monthOptions.map((item) => {
                const selected = item.key === selectedMonthKey;
                const showYear = item.month === 1;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => selectMonth(item.key)}
                    className={`snap-center whitespace-nowrap rounded-full px-4 py-1.5 text-base font-bold transition ${selected ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:bg-primary/10 hover:text-primary'}`}
                  >
                    {showYear ? `${item.year}년 ${item.month}월` : `${item.month}월`}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달" className="flex size-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10">
              <Icon icon="mdi:chevron-right" className="text-2xl" />
            </button>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 pt-2">
          <section className="mb-2 flex items-center gap-3 py-1" aria-label="앨범 검색과 필터">
            <label className="shrink-0">
              <span className="sr-only">미디어 종류</span>
              <select
                value={mediaType}
                onChange={(event) => setMediaType(event.target.value)}
                className="h-10 w-20 rounded-full border-none bg-primary/10 py-2 pl-3 pr-7 text-sm font-bold text-text-primary focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">모두</option>
                <option value="photo">사진</option>
                <option value="video">영상</option>
              </select>
            </label>
            <form onSubmit={(event) => event.preventDefault()} className="flex h-10 min-w-0 flex-1">
              <div className="relative flex h-full w-full items-stretch rounded-full">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="앨범 검색"
                  className="form-input h-full min-w-0 flex-1 rounded-full rounded-r-none border-none bg-primary/10 px-4 pr-8 text-sm text-text-primary focus:outline-0 focus:ring-2 focus:ring-primary/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-12 top-1/2 -translate-y-1/2 text-text-secondary transition-colors hover:text-primary"
                    aria-label="검색어 지우기"
                  >
                    <Icon icon="mdi:close" className="text-lg" />
                  </button>
                )}
                <button
                  type="submit"
                  aria-label="검색"
                  className="flex items-center justify-center rounded-r-full border-none bg-primary/10 px-3 text-text-secondary transition-colors hover:bg-primary/20 hover:text-primary sm:px-4"
                >
                  <Icon icon="mdi:magnify" className="text-xl" />
                </button>
              </div>
            </form>
          </section>

          {timeline.length > 0 ? (
            <section aria-label={`${selectedYear}년 ${selectedMonth}월 타임라인`}>
              {timeline.map(([date, media]) => {
                const collapsed = collapsedDates.includes(date);
                return (
                  <article key={date} className="group/timeline mt-3 first:mt-0">
                    <div className="mb-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleDate(date)}
                        className="z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-transform hover:scale-105"
                        aria-expanded={!collapsed}
                        aria-label={`${formatDateTitle(date)} ${collapsed ? '펼치기' : '접기'}`}
                      >
                        <Icon icon="mdi:chevron-down" className={`text-base transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleDate(date)}
                          className="flex min-w-0 items-end gap-2 text-left"
                          aria-expanded={!collapsed}
                        >
                          <span className="text-xl font-bold sm:text-2xl">{formatDateTitle(date)}</span>
                          <span className="mb-0.5 shrink-0 text-sm font-medium text-text-secondary">{formatWeekday(date)}</span>
                        </button>
                        <div className="-mt-1 flex min-h-5 flex-wrap items-center gap-1.5 text-xs">
                          {(dateTags[date] || []).map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-0.5 text-text-secondary">
                              #{tag}
                              <button type="button" onClick={() => removeTag(date, tag)} className="rounded-full p-0.5 hover:bg-primary/10 hover:text-primary" aria-label={`${tag} 태그 삭제`}>
                                <Icon icon="mdi:close" className="text-xs" />
                              </button>
                            </span>
                          ))}
                          {taggingDate === date ? (
                            <form
                              className="flex items-center gap-1"
                              onSubmit={(event) => {
                                event.preventDefault();
                                addTag(date);
                              }}
                            >
                              <input
                                value={tagDraft}
                                onChange={(event) => setTagDraft(event.target.value)}
                                onBlur={() => addTag(date)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') {
                                    setTaggingDate(null);
                                    setTagDraft('');
                                  }
                                }}
                                autoFocus
                                placeholder="태그"
                                className="h-6 w-24 rounded-full border-primary bg-surface px-2 text-xs focus:border-primary focus:ring-1 focus:ring-primary"
                                aria-label="태그 입력"
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTaggingDate(date);
                                setTagDraft('');
                              }}
                              className="font-semibold text-primary hover:underline"
                            >
                              + 태그
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-[11px] border-l-2 border-border pb-3 pl-4 group-last/timeline:border-transparent group-last/timeline:pb-0 sm:pl-5">
                      {!collapsed && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                          {media.map((item) => (
                            <Link
                              key={item.id}
                              to={`/media/${item.id}?date=${date}`}
                              className="group relative aspect-square overflow-hidden rounded-lg bg-surface shadow-sm transition-transform duration-300 hover:-translate-y-1"
                            >
                              {!viewedMediaIds.includes(item.id) && <NewMediaBadge />}
                              <img src={item.thumbnail || item.src} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              {item.type === 'video' && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                                  <Icon icon="mdi:play-circle" className="text-4xl text-white drop-shadow" />
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <section className="flex min-h-[45vh] flex-col items-center justify-center rounded-xl bg-surface px-6 py-12 text-center shadow-sm">
              <Icon icon="mdi:image-off-outline" className="mb-3 text-5xl text-primary/40" />
              <h2 className="text-lg font-bold">이 기간의 기록이 없어요</h2>
              <p className="mt-2 text-sm text-text-secondary">다른 달을 선택해 보세요.</p>
            </section>
          )}
        </div>
      </main>
    </>
  );
};

export default AlbumPage;
