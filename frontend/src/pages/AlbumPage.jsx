import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import { deleteMediaByDate, deleteVideo, getAllVideos, getMediaDateRange, toMemoryMedia } from '../services/videoApi';
import { addTagsToDateMedia, deleteMemoryDateNote, getMemoryDateNotes, saveMemoryDateNote } from '../services/memoryDateApi';
import { addMediaToMyAlbum, createMyAlbum, deleteMyAlbum } from '../services/myAlbumApi';
import { useAuth } from '../contexts/AuthContext';
import CustomSelect from '../components/common/CustomSelect';
import ToastContainer from '../components/common/Toast';
import Modal from '../components/common/Modal';
import { DateRangePicker } from '../components/common/DatePickerField';

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

const addOneDay = (dateKey) => {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

const NewMediaBadge = () => (
  <span className="absolute right-2 top-2 z-[1] flex size-5 items-center justify-center rounded-full bg-error text-[10px] font-black text-white shadow-md">
    N
  </span>
);

const AlbumPage = () => {
  const monthBarRef = useRef(null);
  const tagSavingRef = useRef(false);
  const noteDraftRef = useRef('');
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);
  const [mediaDateRange, setMediaDateRange] = useState({ minDate: null, maxDate: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [collapsedDates, setCollapsedDates] = useState([]);
  const [dateNotes, setDateNotes] = useState({});
  const [tagError, setTagError] = useState('');
  const [taggingDate, setTaggingDate] = useState(null);
  const [tagDraft, setTagDraft] = useState('');
  const [editingNoteDate, setEditingNoteDate] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteDraftDirty, setNoteDraftDirty] = useState(false);
  const [noteSaveStatus, setNoteSaveStatus] = useState('');
  const [deletingNoteDate, setDeletingNoteDate] = useState(null);
  const [deletingMediaDate, setDeletingMediaDate] = useState(null);
  const [dateDeleteBusy, setDateDeleteBusy] = useState(false);
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
  const [toasts, setToasts] = useState([]);
  const { user } = useAuth();
  const selectionMode = selectedMediaIds.length > 0;
  const viewedMediaIds = user?.watchedVideos || [];
  const monthOptions = useMemo(() => buildMonthOptions(
    mediaDateRange.minDate,
    mediaDateRange.maxDate,
  ), [mediaDateRange]);

  const [selectedYear, selectedMonth] = selectedMonthKey.split('-').map(Number);
  const hasDateFilter = Boolean(searchDateFrom || searchDateTo);
  const isSearchMode = Boolean(searchQuery.trim() || hasDateFilter);
  const dateFilterError = searchDateFrom && searchDateTo && searchDateFrom > searchDateTo
    ? '종료일은 시작일보다 빠를 수 없어요.'
    : '';

  const activeMediaRange = useMemo(() => {
    if (hasDateFilter) {
      return {
        ...(searchDateFrom ? { dateFrom: searchDateFrom } : {}),
        ...(searchDateTo ? { dateTo: addOneDay(searchDateTo) } : {}),
      };
    }
    if (searchQuery.trim()) return {};
    return getMonthRange(selectedMonthKey);
  }, [hasDateFilter, searchDateFrom, searchDateTo, searchQuery, selectedMonthKey]);

  const activeNotesRange = useMemo(() => {
    if (hasDateFilter || searchQuery.trim()) {
      const fallbackFrom = searchDateTo && mediaDateRange.minDate > searchDateTo
        ? searchDateTo
        : mediaDateRange.minDate;
      const fallbackTo = searchDateFrom && mediaDateRange.maxDate < searchDateFrom
        ? searchDateFrom
        : mediaDateRange.maxDate;
      const dateFrom = searchDateFrom || fallbackFrom;
      const inclusiveDateTo = searchDateTo || fallbackTo;
      return dateFrom && inclusiveDateTo ? { dateFrom, dateTo: addOneDay(inclusiveDateTo) } : null;
    }
    return getMonthRange(selectedMonthKey);
  }, [hasDateFilter, mediaDateRange, searchDateFrom, searchDateTo, searchQuery, selectedMonthKey]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((type, message) => {
    setToasts((current) => [...current.slice(-2), {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
    }]);
  }, []);

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
      if (dateFilterError) {
        setMediaItems([]);
        setLoading(false);
        return;
      }
      getAllVideos({
        ...activeMediaRange,
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
  }, [activeMediaRange, dateFilterError, mediaType, reloadKey, searchQuery]);

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
    if (!user?.id || !activeNotesRange || dateFilterError) return undefined;
    getMemoryDateNotes(activeNotesRange, user.id)
      .then((notesByDate) => {
        if (active) {
          setDateNotes(notesByDate);
          setTagError('');
        }
      })
      .catch((error) => {
        if (active) setTagError(error.message);
      });
    return () => {
      active = false;
    };
  }, [activeNotesRange, dateFilterError, user?.id]);

  const selectMonth = (key) => {
    setSelectedMonthKey(key);
    setSearchQuery('');
    setSearchDateFrom('');
    setSearchDateTo('');
    setDateFilterOpen(false);
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
    const normalizedTags = [...new Set(tagDraft.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean))];
    if (!normalizedTags.length || !user?.id) return;
    tagSavingRef.current = true;
    try {
      const result = await addTagsToDateMedia(date, normalizedTags, user.id);
      if (result.addedCount > 0) {
        setTagError('');
        showToast('success', '공통 태그를 사진에 예쁘게 붙였어요 ✨');
      } else {
        showToast('info', '이미 같은 태그가 붙어 있어요.');
      }
      setReloadKey((current) => current + 1);
      setTaggingDate(null);
      setTagDraft('');
    } catch (error) {
      showToast('error', error.message);
    } finally {
      tagSavingRef.current = false;
    }
  };

  const saveNote = async (date) => {
    if (noteSaving || !user?.id) return;
    setNoteSaving(true);
    try {
      const saved = await saveMemoryDateNote(date, noteDraft, user.id);
      setDateNotes((current) => {
        const next = { ...current };
        if (saved.content) next[date] = { content: saved.content, createdBy: saved.createdBy };
        else delete next[date];
        return next;
      });
      setEditingNoteDate(null);
      setNoteDraft('');
      noteDraftRef.current = '';
      setNoteDraftDirty(false);
      setNoteSaveStatus('');
      setTagError('');
    } catch (error) {
      setTagError(error.message);
    } finally {
      setNoteSaving(false);
    }
  };

  useEffect(() => {
    if (!editingNoteDate || !noteDraftDirty || !user?.id) return undefined;
    const date = editingNoteDate;
    const content = noteDraft;
    const timer = window.setTimeout(async () => {
      setNoteSaving(true);
      setNoteSaveStatus('saving');
      try {
        const saved = await saveMemoryDateNote(date, content, user.id);
        setDateNotes((current) => {
          const next = { ...current };
          if (saved.content) next[date] = { content: saved.content, createdBy: saved.createdBy };
          else delete next[date];
          return next;
        });
        if (noteDraftRef.current === content) {
          setNoteDraftDirty(false);
          setNoteSaveStatus('saved');
        }
      } catch (error) {
        setNoteSaveStatus('error');
        showToast('error', error.message);
      } finally {
        setNoteSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [editingNoteDate, noteDraft, noteDraftDirty, showToast, user?.id]);

  const deleteNote = async () => {
    if (!deletingNoteDate || !user?.id) return;
    try {
      await deleteMemoryDateNote(deletingNoteDate, user.id);
      setDateNotes((current) => {
        const next = { ...current };
        delete next[deletingNoteDate];
        return next;
      });
      showToast('success', '메모를 삭제했어요.');
    } catch (error) {
      showToast('error', error.message);
    } finally {
      setDeletingNoteDate(null);
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

  const deleteDateMedia = async () => {
    if (!deletingMediaDate || !user?.id || dateDeleteBusy) return;
    setDateDeleteBusy(true);
    try {
      const result = await deleteMediaByDate(deletingMediaDate);
      const deletedIds = new Set(result.ids || []);
      setMediaItems((current) => current.filter((item) => !deletedIds.has(item.id)));
      setSelectedMediaIds((current) => current.filter((id) => !deletedIds.has(id)));
      setDeletingMediaDate(null);
      showToast('success', `${formatDateTitle(deletingMediaDate)} 미디어 ${result.count}개를 삭제했습니다.`);
      window.dispatchEvent(new Event('hotube:media-updated'));
    } catch (error) {
      showToast('error', error.message);
    } finally {
      setDateDeleteBusy(false);
    }
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
                const selected = !isSearchMode && item.key === selectedMonthKey;
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
          <section className="mb-2 py-1" aria-label="앨범 검색과 필터">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-24 shrink-0">
              <span className="sr-only">미디어 종류</span>
              <CustomSelect
                value={mediaType}
                onChange={(event) => setMediaType(event.target.value)}
                aria-label="미디어 종류"
                className="h-10 rounded-full border-none bg-primary/10 px-3 font-bold"
                menuClassName="rounded-xl"
                options={[
                  { value: 'all', label: '모두' },
                  { value: 'photo', label: '사진' },
                  { value: 'video', label: '영상' },
                ]}
              />
              </div>
              <form onSubmit={(event) => event.preventDefault()} className="flex h-10 min-w-0 flex-1">
              <div className="relative flex h-full w-full items-stretch rounded-full">
                <input
                  type="text"
                  inputMode="search"
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
              <button
                type="button"
                onClick={() => setDateFilterOpen((current) => !current)}
                className={`flex size-10 shrink-0 items-center justify-center rounded-full transition ${hasDateFilter ? 'bg-primary text-white shadow-sm' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                aria-label="검색 기간 설정"
                aria-expanded={dateFilterOpen}
              >
                <Icon icon="mdi:calendar-filter-outline" className="text-xl" />
              </button>
            </div>
            {dateFilterOpen && (
              <div className="mt-2 rounded-2xl border border-border bg-surface p-3 shadow-sm">
                <div className="flex items-center gap-3 px-1 pb-2">
                  <span className="text-sm font-bold text-text-primary">검색 기간</span>
                  {hasDateFilter && (
                    <span className="ml-auto truncate text-xs font-medium text-primary">
                      {searchDateFrom || '시작일'} ~ {searchDateTo || '종료일'}
                    </span>
                  )}
                  {hasDateFilter && (
                    <button
                      type="button"
                      onClick={() => { setSearchDateFrom(''); setSearchDateTo(''); }}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary"
                      aria-label="검색 기간 초기화"
                      title="검색 기간 초기화"
                    >
                      <Icon icon="mdi:close" className="text-lg" />
                    </button>
                  )}
                </div>
                <DateRangePicker
                  from={searchDateFrom}
                  to={searchDateTo}
                  onChange={(range) => {
                    setSearchDateFrom(range.from);
                    setSearchDateTo(range.to);
                    if (range.to) setDateFilterOpen(false);
                  }}
                />
                {dateFilterError && <p className="mt-2 text-xs font-semibold text-error">{dateFilterError}</p>}
              </div>
            )}
          </section>

          {isSearchMode && (
            <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-primary">
              <Icon icon="mdi:magnify" className="text-sm" />
              <span>전체 검색 중</span>
              <span className="font-normal text-text-secondary">· 월을 선택하면 검색이 종료돼요.</span>
            </div>
          )}

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
                const dateNote = dateNotes[date];
                const canEditNote = dateNote?.createdBy === user?.id || ['admin', 'sub-admin'].includes(user?.role);
                return (
                  <article key={date} className="group/timeline mt-3 first:mt-0">
                    <div className="mb-3">
                      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => toggleDate(date)}
                        className="z-[1] flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-transform hover:scale-105"
                        aria-expanded={!collapsed}
                        aria-label={`${formatDateTitle(date)} ${collapsed ? '펼치기' : '접기'}`}
                      >
                        <Icon icon="mdi:chevron-down" className={`text-base transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                      </button>
                      <Link
                        to={`/calendar/${date}`}
                        state={{ returnTo: '/album' }}
                        className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
                      >
                        <span className="truncate text-xl font-bold sm:text-2xl">{formatDateTitle(date)}</span>
                        <span className="shrink-0 text-sm font-medium text-text-secondary">{formatWeekday(date)}</span>
                      </Link>
                      {taggingDate === date ? (
                        <form className="shrink-0" onSubmit={(event) => { event.preventDefault(); addTag(date); }}>
                          <input
                            autoFocus
                            value={tagDraft}
                            onChange={(event) => setTagDraft(event.target.value)}
                            onBlur={() => { if (!tagSavingRef.current) { setTaggingDate(null); setTagDraft(''); } }}
                            onKeyDown={(event) => { if (event.key === 'Escape') { setTaggingDate(null); setTagDraft(''); } }}
                            placeholder="가족, 여행"
                            className="h-8 w-28 rounded-full border-primary bg-surface px-3 text-xs focus:border-primary focus:ring-1 focus:ring-primary sm:w-36"
                            aria-label="공통으로 추가할 태그"
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setTaggingDate(date); setTagDraft(''); }}
                          className="shrink-0 px-1 py-1.5 text-xs font-bold text-primary transition hover:opacity-70"
                        >
                          +공통태그
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => setDeletingMediaDate(date)}
                          disabled={dateDeleteBusy}
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-error/10 hover:text-error disabled:opacity-40"
                          aria-label={`${formatDateTitle(date)} 사진과 영상 전체 삭제`}
                          title="이 날짜의 사진·영상 전체 삭제"
                        >
                          <Icon icon="mdi:trash-can-outline" className="text-lg" />
                        </button>
                      )}
                      </div>
                      <div className="ml-8 mt-1 text-xs text-text-secondary sm:ml-9">
                          {editingNoteDate === date ? (
                            <div className="mt-2 space-y-1.5">
                              <textarea
                                autoFocus
                                value={noteDraft}
                                onChange={(event) => {
                                  setNoteDraft(event.target.value);
                                  noteDraftRef.current = event.target.value;
                                  setNoteDraftDirty(true);
                                  setNoteSaveStatus('pending');
                                }}
                                onBlur={() => {
                                  if (noteDraftDirty) saveNote(date);
                                  else {
                                    setEditingNoteDate(null);
                                    setNoteDraft('');
                                    noteDraftRef.current = '';
                                    setNoteSaveStatus('');
                                  }
                                }}
                                rows={2}
                                maxLength={1000}
                                placeholder="오늘은 어떤 반짝이는 일이 있었나요? ✨"
                                className="w-full resize-none rounded-xl border-warning/40 bg-warning/5 px-3 py-2 text-sm focus:border-warning focus:ring-warning/30"
                              />
                              <p className="min-h-4 px-1 text-[11px] font-medium text-text-secondary" aria-live="polite">
                                {noteSaveStatus === 'saving' && '저장 중…'}
                                {noteSaveStatus === 'saved' && '저장됨 ✓'}
                                {noteSaveStatus === 'error' && '저장하지 못했어요'}
                                {noteSaveStatus === 'pending' && '잠시 후 자동 저장돼요'}
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                              {dateNote && (
                                <div className="min-w-0 flex-1 rounded-2xl border border-warning/20 bg-warning/10 px-3.5 py-2.5 text-left text-sm leading-5 text-text-primary shadow-sm">
                                  <span className="whitespace-pre-wrap">{dateNote.content}</span>
                                </div>
                              )}
                              {dateNote && canEditNote && (
                                <div className="flex shrink-0 items-center gap-0.5 pt-1">
                                  <button type="button" onClick={() => { setEditingNoteDate(date); setNoteDraft(dateNote.content); noteDraftRef.current = dateNote.content; setNoteDraftDirty(false); setNoteSaveStatus(''); }} className="p-0.5 text-text-secondary transition hover:text-primary" aria-label="메모 수정">
                                    <Icon icon="mdi:pencil-outline" className="text-sm" />
                                  </button>
                                  <button type="button" onClick={() => setDeletingNoteDate(date)} className="p-0.5 text-text-secondary transition hover:text-error" aria-label="메모 삭제">
                                    <Icon icon="mdi:delete-outline" className="text-sm" />
                                  </button>
                                </div>
                              )}
                              {!dateNote && (
                                <button
                                  type="button"
                                  onClick={() => { setEditingNoteDate(date); setNoteDraft(''); noteDraftRef.current = ''; setNoteDraftDirty(false); setNoteSaveStatus(''); }}
                                  className="inline-flex shrink-0 items-center gap-1 font-bold text-warning transition hover:opacity-75"
                                >
                                  <Icon icon="mdi:note-plus-outline" className="text-base" />
                                  메모 추가
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                    </div>

                    <div className="ml-[11px] border-l-2 border-border pb-3 pl-4 group-last/timeline:border-transparent group-last/timeline:pb-0 sm:pl-5">
                      {!collapsed && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                          {media.map((item) => {
                            const isFeaturedYoutube = item.source === 'youtube' && item.videoType === 'long';
                            return (
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
                              className={`group relative select-none overflow-hidden bg-surface shadow-sm transition duration-200 ${
                                isFeaturedYoutube
                                  ? 'col-span-3 aspect-video rounded-xl sm:col-span-4'
                                  : 'aspect-square rounded-lg'
                              } ${
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
                                  <Icon icon="mdi:play-circle" className={`${isFeaturedYoutube ? 'text-6xl sm:text-7xl' : 'text-4xl'} text-white drop-shadow`} />
                                </span>
                              )}
                              {isFeaturedYoutube && (
                                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-12 text-white sm:px-5 sm:pb-4">
                                  <span className="min-w-0 truncate text-sm font-bold sm:text-lg">{item.title}</span>
                                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-error px-2.5 py-1 text-[11px] font-bold shadow-sm sm:text-xs">
                                    <Icon icon="mdi:youtube" className="text-base" />
                                    편집영상
                                  </span>
                                </span>
                              )}
                              </Link>
                            );
                          })}
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
          <section className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-border bg-surface/95 p-2.5 shadow-2xl backdrop-blur-md" aria-label="선택한 미디어 작업">
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
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Modal
        isOpen={Boolean(deletingNoteDate)}
        onClose={() => setDeletingNoteDate(null)}
        onConfirm={deleteNote}
        title="메모 삭제"
        message="이날의 메모를 삭제할까요?"
        type="confirm"
        confirmText="삭제"
        cancelText="취소"
      />
      <Modal
        isOpen={Boolean(deletingMediaDate)}
        onClose={() => { if (!dateDeleteBusy) setDeletingMediaDate(null); }}
        onConfirm={deleteDateMedia}
        title="날짜 전체 삭제"
        message={`${deletingMediaDate ? formatDateTitle(deletingMediaDate) : ''}의 사진과 영상 ${timeline.find(([date]) => date === deletingMediaDate)?.[1].length || 0}개를 모두 삭제할까요? 삭제한 파일은 복구할 수 없습니다.`}
        type="confirm"
        confirmText={dateDeleteBusy ? "삭제 중" : "전체 삭제"}
        cancelText="취소"
      />
    </>
  );
};

export default AlbumPage;
