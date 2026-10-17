import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { deleteVideo, updateVideo } from '../services/videoApi';
import { addMediaToMyAlbum, createMyAlbum, deleteMyAlbum } from '../services/myAlbumApi';
import { useAuth } from '../contexts/AuthContext';
import ToastContainer from '../components/common/Toast';
import Modal from '../components/common/Modal';
import DatePickerField from '../components/common/DatePickerField';

const SelectionActionScroller = ({ children }) => {
  const scrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setCanScroll({
      left: element.scrollLeft > 1,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(element);
    observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [updateScroll]);

  const scroll = (direction) => {
    const element = scrollRef.current;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  };

  return (
    <div className="relative px-7">
      <div ref={scrollRef} onScroll={updateScroll} className="scrollbar-hide overflow-x-auto">
        <div className="flex w-max min-w-full gap-0.5">{children}</div>
      </div>
      {[
        ['left', -1, 'left-0', '이전 작업 보기'],
        ['right', 1, 'right-0', '더 많은 작업 보기'],
      ].map(([side, direction, position, label]) => canScroll[side] && (
        <button
          key={side}
          type="button"
          onClick={() => scroll(direction)}
          className={`absolute ${position} top-1/2 flex h-11 w-6 -translate-y-1/2 items-center justify-center rounded-lg bg-primary/10 text-primary transition hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
          aria-label={label}
          title={label}
        >
          <Icon icon={`mdi:chevron-${side}`} className="text-2xl" />
        </button>
      ))}
    </div>
  );
};

const useMediaSelection = ({ mediaItems, setMediaItems, onMediaChanged, allowDelete = true, extraActions = [], actionsBusy = false }) => {
  const { user } = useAuth();
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const [selectionActive, setSelectionActive] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState([]);
  const [activeAction, setSelectionBusy] = useState('');
  const selectionBusy = activeAction || (actionsBusy ? 'external' : '');
  const [selectionError, setSelectionError] = useState('');
  const [albumCreateOpen, setAlbumCreateOpen] = useState(false);
  const [albumTitleDraft, setAlbumTitleDraft] = useState('');
  const [albumCreateError, setAlbumCreateError] = useState('');
  const [selectionDialog, setSelectionDialog] = useState('');
  const [selectionDeleteOpen, setSelectionDeleteOpen] = useState(false);
  const [selectionTagDraft, setSelectionTagDraft] = useState('');
  const [selectionDateDraft, setSelectionDateDraft] = useState('');
  const [selectionFamilies, setSelectionFamilies] = useState(['dad', 'mom']);
  const [toasts, setToasts] = useState([]);
  const selectionMode = selectionActive;
  const canShareCoupleOnly = ['admin', 'sub-admin'].includes(user?.role);
  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((type, message) => {
    setToasts([{
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
    }]);
  }, []);

  const toggleDateMediaSelection = (media) => {
    if (selectionBusy) return;
    const dateMediaIds = media.map((item) => item.id);
    setSelectionActive(true);
    setSelectedMediaIds((current) => {
      const selectedIds = new Set(current);
      const allSelected = dateMediaIds.every((id) => selectedIds.has(id));
      dateMediaIds.forEach((id) => {
        if (allSelected) selectedIds.delete(id);
        else selectedIds.add(id);
      });
      return [...selectedIds];
    });
    setSelectionError('');
  };

  const toggleMediaSelection = (mediaId) => {
    if (selectionBusy) return;
    setSelectedMediaIds((current) => current.includes(mediaId)
      ? current.filter((id) => id !== mediaId)
      : [...current, mediaId]);
    setSelectionError('');
  };

  const beginLongPress = (event, mediaId) => {
    if (selectionBusy) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTriggeredRef.current = false;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setSelectionActive(true);
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
      setSelectionActive(false);
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
    setSelectionBusy('delete');
    const results = await Promise.allSettled(
      selectedMediaIds.map((mediaId) => deleteVideo(mediaId, user.id)),
    );
    const deletedIds = selectedMediaIds.filter((_, index) => results[index].status === 'fulfilled');
    const failedCount = results.length - deletedIds.length;
    setMediaItems((current) => current.filter((item) => !deletedIds.includes(item.id)));
    setSelectionActive(false);
    setSelectedMediaIds([]);
    setSelectionDeleteOpen(false);
    setSelectionError(failedCount > 0
      ? `${deletedIds.length}개를 삭제했고, 권한이 없는 ${failedCount}개는 삭제하지 못했습니다.`
      : '');
    setSelectionBusy('');
    if (deletedIds.length) window.dispatchEvent(new Event('hotube:media-updated'));
  };

  const runSelectedAction = async (action, task, successMessage) => {
    if (!selectedMediaIds.length || selectionBusy) return null;
    setSelectionBusy(action);
    const ids = [...selectedMediaIds];
    const results = await Promise.allSettled(ids.map(task));
    const successIds = ids.filter((_, index) => results[index].status === 'fulfilled');
    const failedIds = ids.filter((_, index) => results[index].status === 'rejected');
    setSelectionBusy('');
    if (successIds.length) showToast('success', `${successIds.length}개 ${successMessage}`);
    if (failedIds.length) setSelectionError(`${failedIds.length}개는 처리하지 못했습니다.`);
    else setSelectionError('');
    return { successIds, failedIds };
  };

  const openSelectedDateDialog = () => {
    const firstSelected = mediaItems.find((item) => selectedMediaIds.includes(item.id));
    setSelectionDateDraft(firstSelected?.date || '');
    setSelectionDialog('date');
  };

  const saveSelectedDate = async (event) => {
    event.preventDefault();
    if (!selectionDateDraft) return;
    const result = await runSelectedAction(
      'date',
      (id) => updateVideo(id, { uploadedAt: selectionDateDraft }, user.id),
      `미디어의 날짜를 ${selectionDateDraft}(으)로 변경했습니다.`,
    );
    if (!result) return;
    setSelectedMediaIds(result.failedIds);
    setSelectionActive(result.failedIds.length > 0);
    setSelectionDialog('');
    onMediaChanged();
    if (result.successIds.length) window.dispatchEvent(new Event('hotube:media-updated'));
  };

  const saveSelectedTags = async (event) => {
    event.preventDefault();
    const tags = [...new Set(selectionTagDraft.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean))];
    if (!tags.length) return;
    const selected = mediaItems.filter((item) => selectedMediaIds.includes(item.id));
    await runSelectedAction('tag', (id) => {
      const item = selected.find((media) => media.id === id);
      return updateVideo(id, { tags: [...new Set([...(item?.tags || []), ...tags])] }, user.id);
    }, '미디어에 태그를 추가했습니다.');
    setSelectionDialog('');
    setSelectionTagDraft('');
    onMediaChanged();
  };

  const saveSelectedFamilies = async () => {
    if (!selectionFamilies.length && !canShareCoupleOnly) return;
    await runSelectedAction('family', (id) => updateVideo(id, { sharedWith: selectionFamilies }, user.id), '미디어의 공유 가족을 변경했습니다.');
    setSelectionDialog('');
    onMediaChanged();
  };

  const downloadSelectedMedia = () => {
    const downloadable = mediaItems.filter((item) => selectedMediaIds.includes(item.id) && item.source === 'file');
    downloadable.forEach((item, index) => window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = `${item.src}${item.src.includes('?') ? '&' : '?'}download=1`;
      link.download = item.title || '';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 150));
    const skipped = selectedMediaIds.length - downloadable.length;
    showToast(downloadable.length ? 'success' : 'info', downloadable.length ? `${downloadable.length}개 다운로드를 시작했습니다.${skipped ? ` YouTube ${skipped}개는 제외했어요.` : ''}` : '다운로드할 파일이 없어요.');
  };

  useEffect(() => () => window.clearTimeout(longPressTimerRef.current), []);

  const clearSelection = () => {
    endLongPress();
    longPressTriggeredRef.current = false;
    setSelectionActive(false);
    setSelectedMediaIds([]);
    setSelectionError('');
  };

  const handleMediaClick = (event, mediaId) => {
    if (!selectionMode && !longPressTriggeredRef.current) return;
    event.preventDefault();
    if (!longPressTriggeredRef.current) toggleMediaSelection(mediaId);
    longPressTriggeredRef.current = false;
  };

  const selectionUI = (
    <>
        {selectionMode && (
          <section className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-2xl rounded-2xl border border-border bg-surface/95 p-2.5 shadow-2xl backdrop-blur-md" aria-label="선택한 미디어 작업">
            <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                setSelectedMediaIds([]);
                setSelectionActive(false);
                setSelectionError('');
              }}
              disabled={Boolean(selectionBusy)}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-primary/10 disabled:opacity-40"
              aria-label="선택 취소"
            >
              <Icon icon="mdi:close" className="text-2xl" />
            </button>
            <span className="text-sm font-black text-primary">{selectedMediaIds.length}개 선택</span>
            <span className="size-10" aria-hidden="true" />
            </div>
            <SelectionActionScroller>
            {[
              ...extraActions,
              ['album', 'mdi:folder-plus-outline', '앨범 만들기', openAlbumCreateModal],
              ['date', 'mdi:calendar-edit-outline', '날짜 변경', openSelectedDateDialog],
              ['family', 'mdi:account-group-outline', '공유가족', () => setSelectionDialog('family')],
              ['download', 'mdi:download-outline', '다운로드', downloadSelectedMedia],
              ['tag', 'mdi:tag-plus-outline', '태그', () => setSelectionDialog('tag')],
            ].map(([key, icon, label, handler]) => (
              <button key={key} type="button" onClick={handler} disabled={Boolean(selectionBusy) || !selectedMediaIds.length} className="flex min-w-[60px] flex-1 flex-col items-center gap-0.5 whitespace-nowrap rounded-xl px-1.5 py-2 text-[11px] font-bold text-text-secondary transition hover:bg-primary/10 hover:text-primary disabled:opacity-40">
                <Icon icon={selectionBusy === key ? 'mdi:loading' : icon} className={`text-xl ${selectionBusy === key ? 'animate-spin' : ''}`} />
                {label}
              </button>
            ))}
            {allowDelete && <button
              type="button"
              onClick={() => setSelectionDeleteOpen(true)}
              disabled={Boolean(selectionBusy) || !selectedMediaIds.length}
              className="flex min-w-[60px] flex-1 flex-col items-center gap-0.5 whitespace-nowrap rounded-xl px-1.5 py-2 text-[11px] font-bold text-error transition hover:bg-error/10 disabled:opacity-40"
            >
              <Icon icon={selectionBusy === 'delete' ? 'mdi:loading' : 'mdi:trash-can-outline'} className={`text-xl ${selectionBusy === 'delete' ? 'animate-spin' : ''}`} />
              삭제
            </button>}
            </SelectionActionScroller>
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
        {selectionDialog && (
          <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
            <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { if (!selectionBusy) setSelectionDialog(''); }} aria-label="작업 창 닫기" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              {selectionDialog === 'date' ? (
                <form onSubmit={saveSelectedDate}>
                  <h2 className="text-lg font-bold text-gray-900">날짜 변경</h2>
                  <p className="mt-1 text-sm text-gray-600">선택한 {selectedMediaIds.length}개 미디어를 같은 날짜로 이동합니다.</p>
                  <div className="mt-4">
                    <DatePickerField
                      label="변경할 날짜"
                      value={selectionDateDraft}
                      onChange={setSelectionDateDraft}
                    />
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => setSelectionDialog('')} disabled={Boolean(selectionBusy)} className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700">취소</button>
                    <button type="submit" disabled={Boolean(selectionBusy) || !selectionDateDraft} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary font-bold text-white disabled:opacity-50">
                      {selectionBusy === 'date' && <Icon icon="mdi:loading" className="animate-spin" />} 변경
                    </button>
                  </div>
                </form>
              ) : selectionDialog === 'tag' ? (
                <form onSubmit={saveSelectedTags}>
                  <h2 className="text-lg font-bold text-gray-900">개별 태그 추가</h2>
                  <p className="mt-1 text-sm text-gray-600">선택한 각 미디어의 기존 태그는 유지하고 새 태그를 추가합니다.</p>
                  <input autoFocus value={selectionTagDraft} onChange={(event) => setSelectionTagDraft(event.target.value)} placeholder="가족, 여행, 생일" className="mt-4 h-11 w-full rounded-xl border-border bg-background px-3 text-sm focus:border-primary focus:ring-primary" />
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => setSelectionDialog('')} disabled={Boolean(selectionBusy)} className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700">취소</button>
                    <button type="submit" disabled={Boolean(selectionBusy) || !selectionTagDraft.trim()} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary font-bold text-white disabled:opacity-50">
                      {selectionBusy === 'tag' && <Icon icon="mdi:loading" className="animate-spin" />} 추가
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <h2 className="text-lg font-bold text-gray-900">공유 가족 변경</h2>
                  <p className="mt-1 text-sm text-gray-600">선택한 미디어를 볼 수 있는 가족을 정해 주세요.</p>
                  <div className={`mt-4 grid gap-2 ${canShareCoupleOnly ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {canShareCoupleOnly && (
                      <button
                        type="button"
                        onClick={() => setSelectionFamilies([])}
                        disabled={Boolean(selectionBusy)}
                        aria-pressed={selectionFamilies.length === 0}
                        className={`rounded-xl border px-2 py-3 text-sm font-bold ${selectionFamilies.length === 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border text-gray-600'}`}
                      >
                        <Icon icon={selectionFamilies.length === 0 ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="mr-1 inline text-lg" />부부
                      </button>
                    )}
                    {[['mom', '엄마가족'], ['dad', '아빠가족']].map(([value, label]) => {
                      const selected = selectionFamilies.includes(value);
                      return <button key={value} type="button" disabled={Boolean(selectionBusy)} aria-pressed={selected} onClick={() => setSelectionFamilies((current) => selected ? current.filter((item) => item !== value) : [...current, value])} className={`rounded-xl border px-2 py-3 text-sm font-bold ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-gray-600'}`}><Icon icon={selected ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'} className="mr-1 inline text-lg" />{label}</button>;
                    })}
                  </div>
                  <div className="mt-5 flex gap-2">
                    <button type="button" onClick={() => setSelectionDialog('')} disabled={Boolean(selectionBusy)} className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700">취소</button>
                    <button type="button" onClick={saveSelectedFamilies} disabled={Boolean(selectionBusy) || (!selectionFamilies.length && !canShareCoupleOnly)} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary font-bold text-white disabled:opacity-50">
                      {selectionBusy === 'family' && <Icon icon="mdi:loading" className="animate-spin" />} 변경
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      <Modal
        isOpen={selectionDeleteOpen}
        onClose={() => { if (!selectionBusy) setSelectionDeleteOpen(false); }}
        onConfirm={deleteSelectedMedia}
        title="선택 항목 삭제"
        message="삭제한 파일은 복구 할 수 없습니다"
        type="confirm"
        confirmText={selectionBusy === 'delete' ? '삭제 중' : '삭제'}
        cancelText="취소"
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );

  return {
    selectionMode, selectedMediaIds, selectionBusy, selectionError, selectionUI,
    clearSelection, toggleDateMediaSelection, beginLongPress, trackLongPress,
    endLongPress, handleMediaClick, showToast,
  };
};

export default useMediaSelection;
