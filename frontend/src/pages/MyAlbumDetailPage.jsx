import MediaPreviewAction from '../components/common/MediaPreviewAction';
import VideoDurationBadge from '../components/common/VideoDurationBadge';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/common/Header';
import useMediaSelection from '../hooks/useMediaSelection';
import { useAuth } from '../contexts/AuthContext';
import { getFavoriteMediaPage, getLikedMediaPage, getMediaPage, toMemoryMedia } from '../services/videoApi';
import {
  addMediaToMyAlbum,
  getMyAlbum,
  getMyAlbumMedia,
  removeMediaFromMyAlbum,
} from '../services/myAlbumApi';

const MyAlbumDetailPage = () => {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isFavorites = albumId === 'favorites';
  const isLikes = albumId === 'likes';
  const isSystemAlbum = isFavorites || isLikes;
  const [album, setAlbum] = useState(null);
  const [media, setMedia] = useState([]);
  const [systemHasMore, setSystemHasMore] = useState(false);
  const [systemLoadingMore, setSystemLoadingMore] = useState(false);
  const systemSentinelRef = useRef(null);
  const systemLoadingMoreRef = useRef(false);
  const [loadedRequestKey, setLoadedRequestKey] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMedia, setPickerMedia] = useState([]);
  const [pickerSelectedIds, setPickerSelectedIds] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerNextCursor, setPickerNextCursor] = useState(null);
  const [pickerLoadingMore, setPickerLoadingMore] = useState(false);
  const pickerSentinelRef = useRef(null);
  const pickerLoadingMoreRef = useRef(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectingAll, setSelectingAll] = useState(false);
  const selectAllRunRef = useRef(0);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const requestKey = user?.id ? `${user.id}:${albumId}` : null;
  const loading = Boolean(requestKey) && loadedRequestKey !== requestKey;
  const {
    selectionMode, selectedMediaIds, selectionBusy, selectionError, selectionUI, clearSelection,
    toggleDateMediaSelection,
    beginLongPress, trackLongPress, endLongPress, handleMediaClick,
  } = useMediaSelection({
    mediaItems: media,
    setMediaItems: setMedia,
    onMediaChanged: () => setReloadKey((current) => current + 1),
    allowDelete: false,
    actionsBusy: removeBusy || selectingAll,
    extraActions: isSystemAlbum ? [] : [[
      'remove', 'mdi:folder-remove-outline', '앨범에서 빼기', () => {
        setRemoveError('');
        setRemoveConfirmOpen(true);
      },
    ]],
  });
  const existingMediaIds = useMemo(() => new Set(media.map((item) => item.id)), [media]);
  const availablePickerMedia = useMemo(
    () => pickerMedia.filter((item) => !existingMediaIds.has(item.id)),
    [existingMediaIds, pickerMedia],
  );

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    selectAllRunRef.current += 1;
    setSelectingAll(false);
    const request = isSystemAlbum
      ? (isFavorites ? getFavoriteMediaPage(user.id) : getLikedMediaPage(user.id)).then((page) => {
        if (active) {
          setMedia(page.items.map(toMemoryMedia));
          setSystemHasMore(page.hasMore);
        }
      })
      : Promise.all([getMyAlbum(user.id, albumId), getMyAlbumMedia(user.id, albumId)])
        .then(([albumData, mediaItems]) => {
          if (!active) return;
          setAlbum(albumData);
          setMedia(mediaItems.map(toMemoryMedia));
        });
    request
      .then(() => {
        if (active) {
          setError('');
          setNotFound(false);
        }
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError.message);
        if (!isSystemAlbum && loadError.message.includes('찾을 수 없습니다')) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoadedRequestKey(requestKey);
      });
    return () => {
      active = false;
      selectAllRunRef.current += 1;
    };
  }, [albumId, isFavorites, isSystemAlbum, reloadKey, requestKey, user?.id]);

  const loadMoreSystemMedia = useCallback(async () => {
    if (!isSystemAlbum || !systemHasMore || systemLoadingMoreRef.current || selectingAll || !user?.id) return;
    systemLoadingMoreRef.current = true;
    setSystemLoadingMore(true);
    try {
      const page = await (isFavorites
        ? getFavoriteMediaPage(user.id, 30, media.length)
        : getLikedMediaPage(user.id, 30, media.length));
      setMedia((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...page.items.map(toMemoryMedia).filter((item) => !ids.has(item.id))];
      });
      setSystemHasMore(page.hasMore);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      systemLoadingMoreRef.current = false;
      setSystemLoadingMore(false);
    }
  }, [isFavorites, isSystemAlbum, media.length, selectingAll, systemHasMore, user?.id]);

  useEffect(() => {
    const target = systemSentinelRef.current;
    if (!target || !systemHasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMoreSystemMedia();
    }, { rootMargin: '500px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMoreSystemMedia, systemHasMore]);

  const loadMorePickerMedia = useCallback(async () => {
    if (!pickerNextCursor || pickerLoadingMoreRef.current) return;
    pickerLoadingMoreRef.current = true;
    setPickerLoadingMore(true);
    try {
      const page = await getMediaPage({ limit: 40, sort: 'date' }, pickerNextCursor);
      setPickerMedia((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...page.items.map(toMemoryMedia).filter((item) => !existingIds.has(item.id))];
      });
      setPickerNextCursor(page.nextCursor);
    } catch (loadError) {
      setPickerError(loadError.message);
    } finally {
      pickerLoadingMoreRef.current = false;
      setPickerLoadingMore(false);
    }
  }, [pickerNextCursor]);

  useEffect(() => {
    const target = pickerSentinelRef.current;
    if (!pickerOpen || !target || !pickerNextCursor) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMorePickerMedia();
    }, { rootMargin: '400px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMorePickerMedia, pickerNextCursor, pickerOpen]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Icon icon="mdi:loading" className="animate-spin text-4xl text-primary" />
      </main>
    );
  }

  if (!isSystemAlbum && (notFound || !album)) {
    return (
      <>
        <Header showSearch={false} />
        <main className="flex min-h-[65vh] flex-col items-center justify-center bg-background px-4 pb-16 text-center">
          <Icon icon="mdi:album-off" className="mb-3 text-6xl text-primary/40" />
          <h1 className="text-xl font-black">앨범을 찾을 수 없어요</h1>
          <Link to="/my-album" className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">내 앨범으로 돌아가기</Link>
        </main>
      </>
    );
  }

  const title = isFavorites ? '즐겨찾기' : isLikes ? '좋아요' : album.title;

  const allSelected = media.length > 0 && !systemHasMore
    && media.every((item) => selectedMediaIds.includes(item.id));

  const selectAllMedia = async () => {
    if (selectionBusy || systemLoadingMoreRef.current) return;
    if (allSelected) {
      clearSelection();
      return;
    }
    const run = ++selectAllRunRef.current;
    setSelectingAll(true);
    try {
      const allMedia = [...media];
      let hasMore = isSystemAlbum && systemHasMore;
      let offset = media.length;
      while (hasMore) {
        const page = await (isFavorites
          ? getFavoriteMediaPage(user.id, 30, offset)
          : getLikedMediaPage(user.id, 30, offset));
        if (run !== selectAllRunRef.current) return;
        const ids = new Set(allMedia.map((item) => item.id));
        allMedia.push(...page.items.map(toMemoryMedia).filter((item) => !ids.has(item.id)));
        offset += page.items.length;
        hasMore = page.hasMore && page.items.length > 0;
      }
      setMedia(allMedia);
      setSystemHasMore(false);
      // Replace a partial selection with all items using the shared selection toggle.
      toggleDateMediaSelection(allMedia);
    } catch (loadError) {
      if (run === selectAllRunRef.current) setError(loadError.message);
    } finally {
      if (run === selectAllRunRef.current) setSelectingAll(false);
    }
  };

  const removeSelectedMedia = async () => {
    if (!selectedMediaIds.length || removeBusy) return;
    setRemoveBusy(true);
    try {
      const result = await removeMediaFromMyAlbum(user.id, albumId, selectedMediaIds);
      const removedIds = new Set(result.removedMediaIds);
      setMedia((current) => current.filter((item) => !removedIds.has(item.id)));
      setAlbum((current) => ({
        ...current,
        mediaCount: Math.max(0, current.mediaCount - removedIds.size),
      }));
      clearSelection();
      setRemoveConfirmOpen(false);
      setRemoveError('');
      setError('');
    } catch (actionError) {
      setRemoveError(actionError.message);
    } finally {
      setRemoveBusy(false);
    }
  };

  const openMediaPicker = async () => {
    setPickerOpen(true);
    setPickerSelectedIds([]);
    setPickerError('');
    setPickerLoading(true);
    try {
      const page = await getMediaPage({ limit: 40, sort: 'date' });
      setPickerMedia(page.items.map(toMemoryMedia));
      setPickerNextCursor(page.nextCursor);
    } catch (loadError) {
      setPickerError(loadError.message);
    } finally {
      setPickerLoading(false);
    }
  };

  const togglePickerMedia = (mediaId) => {
    setPickerSelectedIds((current) => current.includes(mediaId)
      ? current.filter((id) => id !== mediaId)
      : [...current, mediaId]);
  };

  const addSelectedMedia = async () => {
    if (!pickerSelectedIds.length || pickerBusy) return;
    setPickerBusy(true);
    try {
      const result = await addMediaToMyAlbum(user.id, albumId, pickerSelectedIds);
      const addedIds = new Set(result.addedMediaIds);
      const addedItems = pickerMedia.filter((item) => addedIds.has(item.id));
      setMedia((current) => [...current, ...addedItems]);
      setAlbum((current) => ({ ...current, mediaCount: current.mediaCount + addedItems.length }));
      setPickerOpen(false);
      setPickerSelectedIds([]);
      setError('');
    } catch (actionError) {
      setPickerError(actionError.message);
    } finally {
      setPickerBusy(false);
    }
  };

  return (
    <>
      <Header showSearch={false} />
      <main className={`min-h-screen bg-background px-4 text-text-primary ${selectionMode ? 'pb-36' : 'pb-16'}`}>
        <div className="mx-auto max-w-container">
          <header className="mb-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigate('/my-album', { replace: true })}
                  className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary"
                  aria-label="내 앨범으로 돌아가기"
                >
                  <Icon icon="mdi:arrow-left" className="text-xl" />
                </button>
                <h1 className="truncate text-lg font-bold text-[#795548] sm:text-xl">{title}</h1>
              </div>
              <button
                type="button"
                onClick={selectAllMedia}
                disabled={!media.length || Boolean(selectionBusy) || systemLoadingMore}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-sm font-bold text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
                aria-label={`${title} 미디어 전체 선택`}
                aria-pressed={allSelected}
                aria-busy={selectingAll}
                title="이 앨범 전체 선택"
              >
                <span className="text-xs">전체 선택</span>
                <Icon
                  icon={selectingAll ? 'mdi:loading' : allSelected ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline'}
                  className={`text-xl ${allSelected ? 'text-primary' : 'text-text-secondary'} ${selectingAll ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
            {selectionError && <p className="mt-3 text-sm font-semibold text-error">{selectionError}</p>}
            {error && <p className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>}
          </header>

          {media.length > 0 ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={`${title} 사진과 영상`}>
              {media.map((item) => (
                <article className={`group relative aspect-square select-none overflow-hidden rounded-xl bg-surface shadow-sm transition ${
                  selectedMediaIds.includes(item.id)
                    ? 'scale-[0.96] ring-4 ring-primary ring-offset-2 ring-offset-background'
                    : ''
                }`} key={item.id}>
                  <Link
                    to={`/media/${item.id}`}
                    state={{
                      returnTo: `/my-album/${albumId}`,
                      albumMediaIds: media.map((mediaItem) => mediaItem.id),
                    }}
                    className="absolute inset-0"
                    onPointerDown={(event) => beginLongPress(event, item.id)}
                    onPointerMove={trackLongPress}
                    onPointerUp={endLongPress}
                    onPointerCancel={endLongPress}
                    onPointerLeave={endLongPress}
                    onContextMenu={(event) => event.preventDefault()}
                    onClick={(event) => handleMediaClick(event, item.id)}
                  >
                    <img src={item.thumbnail || item.src} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </Link>
                  {!selectionMode && <MediaPreviewAction mediaId={item.id} kind={isFavorites ? 'favorite' : 'like'} initiallyActive={isSystemAlbum} />}
                  {selectionMode && (
                    <span className={`pointer-events-none absolute left-2 top-2 z-10 flex size-7 items-center justify-center rounded-full border-2 shadow-sm ${
                      selectedMediaIds.includes(item.id)
                        ? 'border-primary bg-primary text-white'
                        : 'border-white bg-black/35 text-transparent'
                    }`}>
                      <Icon icon="mdi:check" className="text-lg" />
                    </span>
                  )}
                  {item.type === 'video' && <VideoDurationBadge media={item} />}
                </article>
              ))}
            </section>
          ) : (
            <section className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl bg-surface text-center shadow-sm">
              <Icon icon="mdi:image-plus-outline" className="mb-3 text-5xl text-primary/40" />
              <h2 className="text-lg font-bold">아직 담긴 사진이 없어요</h2>
              <p className="mt-2 text-sm text-text-secondary">좋아하는 순간을 이 앨범에 추가해 보세요.</p>
            </section>
          )}
          {isSystemAlbum && systemHasMore && (
            <div ref={systemSentinelRef} className="flex min-h-20 items-center justify-center" aria-live="polite">
              {systemLoadingMore && <><Icon icon="mdi:loading" className="animate-spin text-2xl text-primary" /><span className="ml-2 text-sm text-text-secondary">더 불러오는 중...</span></>}
            </div>
          )}
          {!isSystemAlbum && (
            <div className="flex justify-center pt-10">
              <button
                type="button"
                onClick={openMediaPicker}
                className="flex items-center gap-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90"
              >
                <Icon icon="mdi:plus" className="text-xl" />
                사진, 영상 추가
              </button>
            </div>
          )}
        </div>

      </main>
      {selectionUI}
      {pickerOpen && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!pickerBusy) setPickerOpen(false);
            }}
            aria-label="사진과 영상 선택 닫기"
          />
          <section className="relative flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" aria-labelledby="media-picker-title">
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 id="media-picker-title" className="text-lg font-bold text-gray-900">사진·영상 추가</h2>
                <p className="mt-0.5 text-xs text-gray-600">앨범에 담을 항목을 여러 개 선택할 수 있어요.</p>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)} disabled={pickerBusy} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-50" aria-label="닫기">
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {pickerLoading ? (
                <div className="flex h-52 items-center justify-center"><Icon icon="mdi:loading" className="animate-spin text-4xl text-primary" /></div>
              ) : pickerError ? (
                <div className="flex h-52 flex-col items-center justify-center text-center">
                  <Icon icon="mdi:alert-circle-outline" className="mb-2 text-4xl text-error/60" />
                  <p className="text-sm font-semibold text-error">{pickerError}</p>
                </div>
              ) : availablePickerMedia.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availablePickerMedia.map((item) => {
                    const selected = pickerSelectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => togglePickerMedia(item.id)}
                        className={`relative aspect-square overflow-hidden rounded-xl bg-primary/10 transition ${
                          selected ? 'scale-[0.96] ring-4 ring-primary ring-offset-2' : ''
                        }`}
                        aria-pressed={selected}
                        aria-label={`${item.title} ${selected ? '선택 해제' : '선택'}`}
                      >
                        {item.type === 'video' && !item.thumbnail ? (
                          <video src={item.src} muted playsInline preload="none" className="h-full w-full object-cover" />
                        ) : (
                          <img src={item.thumbnail || item.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        )}
                        <span className={`absolute right-2 top-2 flex size-7 items-center justify-center rounded-full border-2 shadow-sm ${
                          selected ? 'border-primary bg-primary text-white' : 'border-white bg-black/35 text-transparent'
                        }`}>
                          <Icon icon="mdi:check" className="text-lg" />
                        </span>
                        {item.type === 'video' && <VideoDurationBadge media={item} />}
                      </button>
                    );
                    })}
                  </div>
                  {pickerNextCursor && (
                    <div ref={pickerSentinelRef} className="flex min-h-14 items-center justify-center" aria-live="polite">
                      {pickerLoadingMore && <Icon icon="mdi:loading" className="animate-spin text-2xl text-primary" />}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-52 flex-col items-center justify-center text-center">
                  <Icon icon="mdi:check-circle-outline" className="mb-2 text-4xl text-primary/50" />
                  <p className="font-bold">추가할 수 있는 미디어가 없어요.</p>
                  <p className="mt-1 text-sm text-text-secondary">볼 수 있는 모든 사진과 영상이 이미 담겨 있습니다.</p>
                </div>
              )}
            </div>

            <footer className="flex items-center gap-3 border-t border-border bg-surface px-4 py-3">
              <span className="min-w-14 text-sm font-bold text-primary">{pickerSelectedIds.length}개 선택</span>
              <button type="button" onClick={() => setPickerOpen(false)} disabled={pickerBusy} className="ml-auto h-10 rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-50">취소</button>
              <button
                type="button"
                onClick={addSelectedMedia}
                disabled={!pickerSelectedIds.length || pickerBusy}
                className="flex h-10 items-center gap-1 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {pickerBusy && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
                {pickerBusy ? '추가 중' : '앨범에 추가'}
              </button>
            </footer>
          </section>
        </div>
      )}
      {removeConfirmOpen && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!removeBusy) setRemoveConfirmOpen(false);
            }}
            aria-label="앨범에서 미디어 빼기 닫기"
          />
          <section className="relative w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" aria-labelledby="remove-album-media-title">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-error/10 text-error">
              <Icon icon="mdi:folder-remove-outline" className="text-2xl" />
            </span>
            <h2 id="remove-album-media-title" className="mt-3 text-lg font-bold text-gray-900">앨범에서 빼기</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              선택한 {selectedMediaIds.length}개의 사진·영상을 이 앨범에서 뺄까요?
              <br />
              원본은 삭제되지 않습니다.
            </p>
            {removeError && <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">{removeError}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmOpen(false)}
                disabled={removeBusy}
                className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={removeSelectedMedia}
                disabled={removeBusy}
                className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-error font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {removeBusy && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
                {removeBusy ? '처리 중' : '앨범에서 빼기'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default MyAlbumDetailPage;
