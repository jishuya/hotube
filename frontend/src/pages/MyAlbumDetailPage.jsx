import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../components/common/Header';
import { useAuth } from '../contexts/AuthContext';
import { getAllVideos, getFavoriteMedia, toMemoryMedia } from '../services/videoApi';
import {
  addMediaToMyAlbum,
  getMyAlbum,
  getMyAlbumMedia,
  removeMediaFromMyAlbum,
  updateMyAlbum,
} from '../services/myAlbumApi';

const MyAlbumDetailPage = () => {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isFavorites = albumId === 'favorites';
  const [album, setAlbum] = useState(null);
  const [media, setMedia] = useState([]);
  const [loadedRequestKey, setLoadedRequestKey] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMedia, setPickerMedia] = useState([]);
  const [pickerSelectedIds, setPickerSelectedIds] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const requestKey = user?.id ? `${user.id}:${albumId}` : null;
  const loading = Boolean(requestKey) && loadedRequestKey !== requestKey;
  const existingMediaIds = useMemo(() => new Set(media.map((item) => item.id)), [media]);
  const availablePickerMedia = useMemo(
    () => pickerMedia.filter((item) => !existingMediaIds.has(item.id)),
    [existingMediaIds, pickerMedia],
  );

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const request = isFavorites
      ? getFavoriteMedia(user.id).then((items) => {
        if (active) setMedia(items.map(toMemoryMedia));
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
        if (!isFavorites && loadError.message.includes('찾을 수 없습니다')) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoadedRequestKey(requestKey);
      });
    return () => {
      active = false;
    };
  }, [albumId, isFavorites, requestKey, user?.id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Icon icon="mdi:loading" className="animate-spin text-4xl text-primary" />
      </main>
    );
  }

  if (!isFavorites && (notFound || !album)) {
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

  const title = isFavorites ? '즐겨찾기' : album.title;

  const openRenameAlbum = () => {
    setTitleDraft(title);
    setRenameError('');
    setRenameOpen(true);
  };

  const renameAlbum = async (event) => {
    event.preventDefault();
    const nextTitle = titleDraft.trim();
    if (!nextTitle || renameBusy) {
      if (!nextTitle) setRenameError('앨범 제목을 입력해 주세요.');
      return;
    }
    if (nextTitle === title) {
      setRenameOpen(false);
      return;
    }
    setRenameBusy(true);
    try {
      const updated = await updateMyAlbum(user.id, albumId, { title: nextTitle });
      setAlbum(updated);
      setError('');
      setRenameOpen(false);
    } catch (actionError) {
      setRenameError(actionError.message);
    } finally {
      setRenameBusy(false);
    }
  };

  const removeMedia = async (item) => {
    if (!window.confirm(`‘${item.title}’을(를) 이 앨범에서 뺄까요?`)) return;
    try {
      await removeMediaFromMyAlbum(user.id, albumId, [item.id]);
      setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id));
      setAlbum((current) => ({ ...current, mediaCount: Math.max(0, current.mediaCount - 1) }));
      setError('');
    } catch (actionError) {
      setError(actionError.message);
    }
  };

  const openMediaPicker = async () => {
    setPickerOpen(true);
    setPickerSelectedIds([]);
    setPickerError('');
    setPickerLoading(true);
    try {
      const items = await getAllVideos();
      setPickerMedia(items.map(toMemoryMedia));
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
      <main className="min-h-screen bg-background px-4 pb-16 text-text-primary">
        <div className="mx-auto max-w-container">
          <header className="mb-6">
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
                <h1 className="truncate text-2xl font-bold sm:text-3xl">{title}</h1>
                {!isFavorites && (
                  <button
                    type="button"
                    onClick={openRenameAlbum}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary"
                    aria-label="앨범 제목 수정"
                  >
                    <Icon icon="mdi:pencil-outline" className="text-xl" />
                  </button>
                )}
              </div>
              <span className="shrink-0 text-sm font-semibold text-text-secondary">{media.length}</span>
            </div>
            {isFavorites && <p className="mt-2 text-sm text-text-secondary">좋아하는 순간만 한곳에 모았어요.</p>}
            {error && <p className="mt-3 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>}
          </header>

          {media.length > 0 ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={`${title} 사진과 영상`}>
              {media.map((item) => (
                <article key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-surface shadow-sm">
                  <Link
                    to={`/media/${item.id}`}
                    state={{
                      returnTo: `/my-album/${albumId}`,
                      albumMediaIds: media.map((mediaItem) => mediaItem.id),
                    }}
                    className="absolute inset-0"
                  >
                    <img src={item.thumbnail || item.src} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </Link>
                  {isFavorites && (
                    <span className="pointer-events-none absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm">
                      <Icon icon="mdi:heart" />
                    </span>
                  )}
                  {!isFavorites && (
                    <button
                      type="button"
                      onClick={() => removeMedia(item)}
                      className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-error shadow-sm transition hover:bg-white"
                      aria-label={`${item.title} 앨범에서 빼기`}
                    >
                      <Icon icon="mdi:close" />
                    </button>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      {item.type === 'video' && <Icon icon="mdi:play-circle" className="shrink-0 text-2xl" />}
                    </div>
                  </div>
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
          {!isFavorites && (
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
      {renameOpen && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!renameBusy) setRenameOpen(false);
            }}
            aria-label="앨범 제목 수정 닫기"
          />
          <form
            onSubmit={renameAlbum}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !renameBusy) setRenameOpen(false);
            }}
            className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            aria-labelledby="detail-rename-album-title"
          >
            <div className="flex flex-col items-center text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon icon="mdi:pencil-outline" className="text-2xl" />
              </span>
              <h2 id="detail-rename-album-title" className="mt-3 text-lg font-bold text-gray-900">앨범 제목 수정</h2>
              <p className="mt-1 text-sm text-gray-600">변경할 앨범 제목을 입력해 주세요.</p>
            </div>
            <label className="mt-5 block">
              <span className="sr-only">앨범 제목</span>
              <input
                autoFocus
                value={titleDraft}
                onChange={(event) => {
                  setTitleDraft(event.target.value);
                  setRenameError('');
                }}
                maxLength={80}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="mt-1 flex min-h-5 items-start justify-between gap-2 text-xs">
              <span className="font-semibold text-error">{renameError}</span>
              <span className="shrink-0 text-text-secondary">{titleDraft.length}/80</span>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setRenameOpen(false)}
                disabled={renameBusy}
                className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={renameBusy || !titleDraft.trim()}
                className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {renameBusy && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
                {renameBusy ? '저장 중' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}
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
                          <video src={item.src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        ) : (
                          <img src={item.thumbnail || item.src} alt="" className="h-full w-full object-cover" />
                        )}
                        <span className={`absolute right-2 top-2 flex size-7 items-center justify-center rounded-full border-2 shadow-sm ${
                          selected ? 'border-primary bg-primary text-white' : 'border-white bg-black/35 text-transparent'
                        }`}>
                          <Icon icon="mdi:check" className="text-lg" />
                        </span>
                        {item.type === 'video' && <Icon icon="mdi:play-circle" className="absolute bottom-2 left-2 text-2xl text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>
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
    </>
  );
};

export default MyAlbumDetailPage;
