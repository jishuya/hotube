import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import { deleteVideo, getAllVideos, getMediaDateRange, toMemoryMedia } from '../services/videoApi';
import { addDateAlbumTag, deleteDateAlbumTag, getDateAlbumTags } from '../services/dateAlbumTagApi';
import { addMediaToMyAlbum, createMyAlbum, deleteMyAlbum } from '../services/myAlbumApi';
import { useAuth } from '../contexts/AuthContext';

const formatMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const currentMonthKey = formatMonthKey(new Date());

const buildMonthOptions = (minDate, maxDate) => {
  const minKey = minDate?.slice(0, 7) || currentMonthKey;
  const maxKey = maxDate?.slice(0, 7) || currentMonthKey;
  const firstKey = maxKey > currentMonthKey ? maxKey : currentMonthKey;
  const lastKey = minKey < currentMonthKey ? minKey : currentMonthKey;
  const [firstYear, firstMonth] = firstKey.split('-').map(Number);
  const [lastYear, lastMonth] = lastKey.split('-').map(Number);
  const cursor = new Date(firstYear, firstMonth - 1, 1);
  const last = new Date(lastYear, lastMonth - 1, 1);
  const options = [];

  while (cursor >= last) {
    options.push({
      key: formatMonthKey(cursor),
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
    });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return options;
};

const formatDateTitle = (dateString) => new Intl.DateTimeFormat('ko-KR', {
  month: 'long', day: 'numeric',
}).format(new Date(`${dateString}T00:00:00`));

const formatWeekday = (dateString) => new Intl.DateTimeFormat('ko-KR', {
  weekday: 'long',
}).format(new Date(`${dateString}T00:00:00`));

const getMonthRange = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const nextMonth = new Date(year, month, 1);
  return {
    dateFrom: `${monthKey}-01`,
    dateTo: [
      nextMonth.getFullYear(),
      String(nextMonth.getMonth() + 1).padStart(2, '0'),
      '01',
    ].join('-'),
  };
};

const NewMediaBadge = () => (
  <span className="absolute right-2 top-2 z-[1] flex size-5 items-center justify-center rounded-full bg-error text-[10px] font-black text-white shadow-md">
    N
  </span>
);

const AlbumPage = () => {
  const monthBarRef = useRef(null);
  const tagSavingRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [mediaDateRange, setMediaDateRange] = useState({ minDate: null, maxDate: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [collapsedDates, setCollapsedDates] = useState([]);
  const [dateTags, setDateTags] = useState({});
  const [tagError, setTagError] = useState('');
  const [taggingDate, setTaggingDate] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedMediaIds, setSelectedMediaIds] = useState([]);
  const [selectionBusy, setSelectionBusy] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [albumCreateOpen, setAlbumCreateOpen] = useState(false);
  const [albumTitleDraft, setAlbumTitleDraft] = useState('');
  const [albumCreateError, setAlbumCreateError] = useState('');
  const { user } = useAuth();
  const selectionMode = selectedMediaIds.length > 0;
  const viewedMediaIds = user?.watchedVideos || [];
  const monthOptions = useMemo(() => buildMonthOptions(
    mediaDateRange.minDate,
    mediaDateRange.maxDate,
  ), [mediaDateRange]);

  const [selectedYear, selectedMonth] = selectedMonthKey.split('-').map(Number);

  const timeline = useMemo(() => {
    return Object.entries(mediaItems.reduce((groups, item) => {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push(item);
      return groups;
    }, {})).sort(([a], [b]) => b.localeCompare(a));
  }, [mediaItems]);

  useEffect(() => {
    let active = true;
    const loadMedia = () => {
      setLoading(true);
      setLoadError('');
      getAllVideos({
        ...getMonthRange(selectedMonthKey),
        search: searchQuery.trim().replace(/^#/, ''),
        mediaType,
      })
        .then((items) => {
          if (active) setMediaItems(items.map(toMemoryMedia));
        })
        .catch((error) => {
          if (active) setLoadError(error.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    const timer = window.setTimeout(loadMedia, searchQuery.trim() ? 250 : 0);
    window.addEventListener('hotube:media-updated', loadMedia);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('hotube:media-updated', loadMedia);
    };
  }, [selectedMonthKey, searchQuery, mediaType, reloadKey]);

  useEffect(() => {
    let active = true;
    const loadDateRange = () => getMediaDateRange()
      .then((range) => {
        if (active) setMediaDateRange(range);
      })
      .catch((error) => console.error('앨범 날짜 범위 조회 실패:', error));

    loadDateRange();
    window.addEventListener('hotube:media-updated', loadDateRange);
    return () => {
      active = false;
      window.removeEventListener('hotube:media-updated', loadDateRange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    getDateAlbumTags(getMonthRange(selectedMonthKey))
      .then((tagsByDate) => {
        if (active) {
          setDateTags(tagsByDate);
          setTagError('');
        }
      })
      .catch((error) => {
        if (active) setTagError(error.message);
      });
    return () => {
      active = false;
    };
  }, [selectedMonthKey]);

  const selectMonth = (key) => {
    setSelectedMonthKey(key);
    setCollapsedDates([]);
    setSelectedMediaIds([]);
    setSelectionError('');
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

  const addTag = async (date) => {
    if (tagSavingRef.current) return;
    const normalizedTag = tagDraft.trim().replace(/^#/, '');
    const currentTags = dateTags[date] || [];
    tagSavingRef.current = true;
    if (normalizedTag && !currentTags.includes(normalizedTag)) {
      try {
        await addDateAlbumTag(date, normalizedTag);
        setDateTags((current) => ({ ...current, [date]: [...(current[date] || []), normalizedTag] }));
        setTagError('');
      } catch (error) {
        setTagError(error.message);
      }
    }
    tagSavingRef.current = false;
    setTaggingDate(null);
    setTagDraft('');
  };

  const removeTag = async (date, tag) => {
    try {
      await deleteDateAlbumTag(date, tag);
      setDateTags((current) => ({
        ...current,
        [date]: (current[date] || []).filter((item) => item !== tag),
      }));
      setTagError('');
    } catch (error) {
      setTagError(error.message);
    }
  };

  const toggleMediaSelection = (mediaId) => {
    setSelectedMediaIds((current) => current.includes(mediaId)
      ? current.filter((id) => id !== mediaId)
      : [...current, mediaId]);
    setSelectionError('');
  };

  const beginLongPress = (event, mediaId) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTriggeredRef.current = false;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      toggleMediaSelection(mediaId);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 550);
  };

  const trackLongPress = (event) => {
    const start = pointerStartRef.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
      window.clearTimeout(longPressTimerRef.current);
      pointerStartRef.current = null;
    }
  };

  const endLongPress = () => {
    window.clearTimeout(longPressTimerRef.current);
    pointerStartRef.current = null;
  };

  const openAlbumCreateModal = () => {
    setAlbumTitleDraft('');
    setAlbumCreateError('');
    setAlbumCreateOpen(true);
  };

  const createAlbumFromSelection = async (event) => {
    event.preventDefault();
    const title = albumTitleDraft.trim();
    if (!title || !user?.id || selectionBusy) {
      if (!title) setAlbumCreateError('앨범 제목을 입력해 주세요.');
      return;
    }
    setSelectionBusy('album');
    let createdAlbum = null;
    try {
      createdAlbum = await createMyAlbum(user.id, { title });
      await addMediaToMyAlbum(user.id, createdAlbum.id, selectedMediaIds);
      setSelectedMediaIds([]);
      setSelectionError('');
      setAlbumCreateOpen(false);
      setAlbumTitleDraft('');
    } catch (error) {
      if (createdAlbum) await deleteMyAlbum(user.id, createdAlbum.id).catch(() => {});
      setAlbumCreateError(error.message);
    } finally {
      setSelectionBusy('');
    }
  };

  const deleteSelectedMedia = async () => {
    if (!user?.id || selectionBusy) return;
    if (!window.confirm(`선택한 ${selectedMediaIds.length}개의 사진·영상을 삭제할까요? 삭제한 파일은 복구할 수 없습니다.`)) return;
    setSelectionBusy('delete');
    const results = await Promise.allSettled(
      selectedMediaIds.map((mediaId) => deleteVideo(mediaId, user.id)),
    );
    const deletedIds = selectedMediaIds.filter((_, index) => results[index].status === 'fulfilled');
    const failedCount = results.length - deletedIds.length;
    setMediaItems((current) => current.filter((item) => !deletedIds.includes(item.id)));
    setSelectedMediaIds([]);
    setSelectionError(failedCount > 0
      ? `${deletedIds.length}개를 삭제했고, 권한이 없는 ${failedCount}개는 삭제하지 못했습니다.`
      : '');
    setSelectionBusy('');
    if (deletedIds.length) window.dispatchEvent(new Event('hotube:media-updated'));
  };

  return (
    <>
      <Header showSearch={false} />
      <main className={`min-h-screen bg-background text-text-primary ${selectionMode ? 'pb-36' : 'pb-16'}`}>
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

          {tagError && <p className="mb-2 rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">{tagError}</p>}
          {selectionError && <p className="mb-2 rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">{selectionError}</p>}

          {loading ? (
            <section className="flex min-h-[45vh] items-center justify-center" aria-label="앨범 불러오는 중">
              <Icon icon="mdi:loading" className="animate-spin text-4xl text-primary" />
            </section>
          ) : loadError ? (
            <section className="flex min-h-[45vh] flex-col items-center justify-center rounded-xl bg-surface px-6 py-12 text-center shadow-sm">
              <Icon icon="mdi:alert-circle-outline" className="mb-3 text-5xl text-error/70" />
              <h2 className="text-lg font-bold">앨범을 불러오지 못했어요</h2>
              <p className="mt-2 text-sm text-text-secondary">{loadError}</p>
              <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">
                다시 시도
              </button>
            </section>
          ) : timeline.length > 0 ? (
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
                        <Link
                          to={`/calendar/${date}`}
                          state={{ returnTo: '/album' }}
                          className="flex min-w-0 items-end gap-2 text-left"
                        >
                          <span className="text-xl font-bold sm:text-2xl">{formatDateTitle(date)}</span>
                          <span className="mb-0.5 shrink-0 text-sm font-medium text-text-secondary">{formatWeekday(date)}</span>
                        </Link>
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
                              state={{ returnTo: '/album' }}
                              onPointerDown={(event) => beginLongPress(event, item.id)}
                              onPointerMove={trackLongPress}
                              onPointerUp={endLongPress}
                              onPointerCancel={endLongPress}
                              onPointerLeave={endLongPress}
                              onContextMenu={(event) => event.preventDefault()}
                              onClick={(event) => {
                                if (!selectionMode && !longPressTriggeredRef.current) return;
                                event.preventDefault();
                                if (!longPressTriggeredRef.current) toggleMediaSelection(item.id);
                                longPressTriggeredRef.current = false;
                              }}
                              className={`group relative aspect-square select-none overflow-hidden rounded-lg bg-surface shadow-sm transition duration-200 ${
                                selectedMediaIds.includes(item.id)
                                  ? 'scale-[0.96] ring-4 ring-primary ring-offset-2 ring-offset-background'
                                  : 'hover:-translate-y-1'
                              }`}
                              aria-label={`${item.title}, ${item.type === 'video' ? '영상' : '사진'}`}
                            >
                              {!viewedMediaIds.includes(item.id) && <NewMediaBadge />}
                              {selectionMode && (
                                <span className={`absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border-2 shadow-sm ${
                                  selectedMediaIds.includes(item.id)
                                    ? 'border-primary bg-primary text-white'
                                    : 'border-white bg-black/35 text-transparent'
                                }`}>
                                  <Icon icon="mdi:check" className="text-lg" />
                                </span>
                              )}
                              {item.type === 'video' && !item.thumbnail ? (
                                <video
                                  src={item.src}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              ) : (
                                <img
                                  src={item.thumbnail || item.src}
                                  alt={item.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              )}
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
        {selectionMode && (
          <section className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-border bg-surface/95 p-2.5 shadow-2xl backdrop-blur-md" aria-label="선택한 미디어 작업">
            <button
              type="button"
              onClick={() => {
                setSelectedMediaIds([]);
                setSelectionError('');
              }}
              disabled={Boolean(selectionBusy)}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-primary/10 disabled:opacity-40"
              aria-label="선택 취소"
            >
              <Icon icon="mdi:close" className="text-2xl" />
            </button>
            <span className="min-w-12 text-center text-sm font-black text-primary">{selectedMediaIds.length}개</span>
            <button
              type="button"
              onClick={openAlbumCreateModal}
              disabled={Boolean(selectionBusy)}
              className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Icon icon={selectionBusy === 'album' ? 'mdi:loading' : 'mdi:folder-plus-outline'} className={`text-lg ${selectionBusy === 'album' ? 'animate-spin' : ''}`} />
              앨범 만들기
            </button>
            <button
              type="button"
              onClick={deleteSelectedMedia}
              disabled={Boolean(selectionBusy)}
              className="flex h-10 items-center justify-center gap-1 rounded-xl bg-error px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <Icon icon={selectionBusy === 'delete' ? 'mdi:loading' : 'mdi:trash-can-outline'} className={`text-lg ${selectionBusy === 'delete' ? 'animate-spin' : ''}`} />
              삭제
            </button>
          </section>
        )}
        {albumCreateOpen && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => {
                if (!selectionBusy) setAlbumCreateOpen(false);
              }}
              aria-label="새 앨범 만들기 닫기"
            />
            <form
              onSubmit={createAlbumFromSelection}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !selectionBusy) setAlbumCreateOpen(false);
              }}
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
              aria-labelledby="selection-create-album-title"
            >
              <div className="flex flex-col items-center text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon icon="mdi:image-multiple-outline" className="text-2xl" />
                </span>
                <h2 id="selection-create-album-title" className="mt-3 text-lg font-bold text-gray-900">새 앨범 만들기</h2>
                <p className="mt-1 text-sm text-gray-600">선택한 {selectedMediaIds.length}개 미디어를 담을 앨범 제목을 입력해 주세요.</p>
              </div>

              <label className="mt-5 block">
                <span className="sr-only">앨범 제목</span>
                <input
                  autoFocus
                  value={albumTitleDraft}
                  onChange={(event) => {
                    setAlbumTitleDraft(event.target.value);
                    setAlbumCreateError('');
                  }}
                  maxLength={80}
                  placeholder="예: 우리 가족 여름 여행"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <div className="mt-1 flex min-h-5 items-start justify-between gap-2 text-xs">
                <span className="font-semibold text-error">{albumCreateError}</span>
                <span className="shrink-0 text-text-secondary">{albumTitleDraft.length}/80</span>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAlbumCreateOpen(false)}
                  disabled={Boolean(selectionBusy)}
                  className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={Boolean(selectionBusy) || !albumTitleDraft.trim()}
                  className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
                >
                  {selectionBusy === 'album' && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
                  {selectionBusy === 'album' ? '만드는 중' : '만들기'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
};

export default AlbumPage;
