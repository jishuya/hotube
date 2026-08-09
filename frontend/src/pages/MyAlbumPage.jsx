import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import { useAuth } from '../contexts/AuthContext';
import { createMyAlbum, deleteMyAlbum, getMyAlbums, updateMyAlbum } from '../services/myAlbumApi';
import { getFavoriteMedia, getLikedMedia, toMemoryMedia } from '../services/videoApi';

const SavedMediaSection = ({ id, title, media, loading, icon, emptyIcon, description }) => (
  <section aria-labelledby={`${id}-title`}>
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon icon={icon} className="text-xl" />
        </span>
        <h2 id={`${id}-title`} className="text-xl font-bold">{title}</h2>
      </div>
      <Link to={`/my-album/${id}`} className="shrink-0 text-sm font-bold text-primary hover:underline">
        더보기
      </Link>
    </div>

    {loading ? (
      <div className="flex h-32 items-center justify-center"><Icon icon="mdi:loading" className="animate-spin text-3xl text-primary" /></div>
    ) : media.length > 0 ? (
      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label={`${title} 미리보기`}>
        {media.slice(0, 6).map((item) => (
          <Link
            key={item.id}
            to={`/my-album/${id}`}
            className="group relative aspect-square overflow-hidden rounded-xl bg-surface shadow-sm"
            aria-label={`${item.title}, ${title} 전체 보기`}
          >
            <img src={item.thumbnail || item.src} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm backdrop-blur-sm">
              <Icon icon={icon} className="text-base" />
            </span>
            {item.type === 'video' && (
              <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-lg">
                <Icon icon="mdi:play-circle" className="text-4xl" />
              </span>
            )}
          </Link>
        ))}
      </div>
    ) : (
      <div className="flex h-32 flex-col items-center justify-center rounded-2xl bg-surface text-center text-text-secondary">
        <Icon icon={emptyIcon} className="mb-2 text-3xl text-primary/40" />
        <p className="text-sm font-semibold">{description}</p>
      </div>
    )}
  </section>
);

const MyAlbumPage = () => {
  const { user } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [favoriteMedia, setFavoriteMedia] = useState([]);
  const [likedMedia, setLikedMedia] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [albumTitleDraft, setAlbumTitleDraft] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingAlbum, setDeletingAlbum] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const loading = Boolean(user?.id) && loadedUserId !== user.id;

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    Promise.allSettled([getMyAlbums(user.id), getFavoriteMedia(user.id), getLikedMedia(user.id)])
      .then(([albumsResult, favoritesResult, likesResult]) => {
        if (!active) return;
        if (albumsResult.status === 'fulfilled') setAlbums(albumsResult.value);
        if (favoritesResult.status === 'fulfilled') {
          setFavoriteMedia(favoritesResult.value.map(toMemoryMedia));
        }
        if (likesResult.status === 'fulfilled') {
          setLikedMedia(likesResult.value.map(toMemoryMedia));
        }
        const failedRequests = [albumsResult, favoritesResult, likesResult]
          .filter((result) => result.status === 'rejected');
        setError(failedRequests.length > 0
          ? failedRequests.map((result) => result.reason.message).join(' · ')
          : '');
      })
      .finally(() => {
        if (active) setLoadedUserId(user.id);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!createOpen && !editingAlbum && !deletingAlbum) return undefined;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (createOpen && !createBusy) setCreateOpen(false);
      if (editingAlbum && !editBusy) setEditingAlbum(null);
      if (deletingAlbum && !deleteBusy) setDeletingAlbum(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [createBusy, createOpen, deleteBusy, deletingAlbum, editBusy, editingAlbum]);

  const openCreateAlbum = () => {
    setAlbumTitleDraft('');
    setCreateError('');
    setCreateOpen(true);
  };

  const addAlbum = async (event) => {
    event.preventDefault();
    const title = albumTitleDraft.trim();
    if (!title || createBusy) {
      if (!title) setCreateError('앨범 제목을 입력해 주세요.');
      return;
    }
    setCreateBusy(true);
    try {
      const created = await createMyAlbum(user.id, { title });
      setAlbums((current) => [created, ...current]);
      setError('');
      setCreateOpen(false);
      setAlbumTitleDraft('');
    } catch (actionError) {
      setCreateError(actionError.message);
    } finally {
      setCreateBusy(false);
    }
  };

  const openRenameAlbum = (album) => {
    setEditingAlbum(album);
    setEditTitleDraft(album.title);
    setEditError('');
    setOpenMenuId(null);
  };

  const renameAlbum = async (event) => {
    event.preventDefault();
    const title = editTitleDraft.trim();
    if (!title || !editingAlbum || editBusy) {
      if (!title) setEditError('앨범 제목을 입력해 주세요.');
      return;
    }
    if (title === editingAlbum.title) {
      setEditingAlbum(null);
      return;
    }
    setEditBusy(true);
    try {
      const updated = await updateMyAlbum(user.id, editingAlbum.id, { title });
      setAlbums((current) => current.map((item) => (
        item.id === editingAlbum.id ? updated : item
      )));
      setError('');
      setEditingAlbum(null);
    } catch (actionError) {
      setEditError(actionError.message);
    } finally {
      setEditBusy(false);
    }
  };

  const openDeleteAlbum = (album) => {
    setDeletingAlbum(album);
    setDeleteError('');
    setOpenMenuId(null);
  };

  const removeAlbum = async () => {
    if (!deletingAlbum || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteMyAlbum(user.id, deletingAlbum.id);
      setAlbums((current) => current.filter((item) => item.id !== deletingAlbum.id));
      setError('');
      setDeletingAlbum(null);
    } catch (actionError) {
      setDeleteError(actionError.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
  <>
    <Header showSearch={false} />
    <main className="min-h-screen bg-background px-4 pb-16 text-text-primary">
      <div className="mx-auto max-w-container">
        <SavedMediaSection id="favorites" title="즐겨찾기" media={favoriteMedia} loading={loading} icon="mdi:bookmark" emptyIcon="mdi:bookmark-outline" description="아직 즐겨찾기가 없어요" />
        <div className="mt-10">
          <SavedMediaSection id="likes" title="좋아요" media={likedMedia} loading={loading} icon="mdi:heart" emptyIcon="mdi:heart-outline" description="아직 좋아요한 미디어가 없어요" />
        </div>

        <section className="mt-10" aria-labelledby="my-albums-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 id="my-albums-title" className="text-xl font-bold">마이 앨범</h2>
            </div>
            <button type="button" onClick={openCreateAlbum} className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90">
              <Icon icon="mdi:plus" className="text-lg" />
              새 앨범
            </button>
          </div>

          {error && <p className="mb-4 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>}

          {!loading && albums.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl bg-surface text-center shadow-sm">
              <Icon icon="mdi:image-multiple-outline" className="mb-3 text-5xl text-primary/35" />
              <h3 className="font-bold">아직 만든 앨범이 없어요</h3>
              <button type="button" onClick={openCreateAlbum} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">첫 앨범 만들기</button>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {albums.map((album) => {
              return (
                <article key={album.id} className="group relative overflow-visible rounded-2xl bg-surface p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <button
                    type="button"
                    aria-label={`${album.title} 앨범 메뉴`}
                    aria-expanded={openMenuId === album.id}
                    onClick={() => setOpenMenuId((current) => current === album.id ? null : album.id)}
                    className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-text-secondary shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-primary"
                  >
                    <Icon icon="mdi:dots-vertical" className="text-xl" />
                  </button>
                  {openMenuId === album.id && (
                    <div className="absolute right-3 top-12 z-20 w-28 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => openRenameAlbum(album)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-primary/10"
                      >
                        <Icon icon="mdi:pencil-outline" />
                        제목 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteAlbum(album)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-error hover:bg-error/10"
                      >
                        <Icon icon="mdi:trash-can-outline" />
                        앨범 삭제
                      </button>
                    </div>
                  )}
                  <Link to={`/my-album/${album.id}`} className="relative block aspect-square overflow-hidden rounded-xl bg-primary/10">
                    {album.coverThumbnailUrl ? (
                      <img src={album.coverThumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <Icon icon="mdi:image-multiple-outline" className="absolute inset-0 m-auto text-4xl text-primary/40" />
                    )}
                  </Link>
                  <div className="px-1 pb-2 pt-3">
                    <div className="flex items-center gap-1">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">
                        <Link to={`/my-album/${album.id}`} className="hover:text-primary">{album.title}</Link>
                      </h3>
                      <span className="shrink-0 text-xs font-semibold text-text-secondary">{album.mediaCount}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          )}
        </section>
      </div>
    </main>
    {createOpen && (
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            if (!createBusy) setCreateOpen(false);
          }}
          aria-label="새 앨범 만들기 닫기"
        />
        <form
          onSubmit={addAlbum}
          className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          aria-labelledby="create-album-title"
        >
          <div className="flex flex-col items-center text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon icon="mdi:image-multiple-outline" className="text-2xl" />
            </span>
            <h2 id="create-album-title" className="mt-3 text-lg font-bold text-gray-900">새 앨범 만들기</h2>
            <p className="mt-1 text-sm text-gray-600">새 앨범 제목을 입력해 주세요.</p>
          </div>

          <label className="mt-5 block">
            <span className="sr-only">앨범 제목</span>
            <input
              autoFocus
              value={albumTitleDraft}
              onChange={(event) => {
                setAlbumTitleDraft(event.target.value);
                setCreateError('');
              }}
              maxLength={80}
              placeholder="예: 우리 가족 여름 여행"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="mt-1 flex min-h-5 items-start justify-between gap-2 text-xs">
            <span className="font-semibold text-error">{createError}</span>
            <span className="shrink-0 text-text-secondary">{albumTitleDraft.length}/80</span>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={createBusy}
              className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createBusy || !albumTitleDraft.trim()}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {createBusy && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
              {createBusy ? '만드는 중' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    )}
    {editingAlbum && (
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            if (!editBusy) setEditingAlbum(null);
          }}
          aria-label="앨범 제목 수정 닫기"
        />
        <form
          onSubmit={renameAlbum}
          className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          aria-labelledby="rename-album-title"
        >
          <div className="flex flex-col items-center text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon icon="mdi:pencil-outline" className="text-2xl" />
            </span>
            <h2 id="rename-album-title" className="mt-3 text-lg font-bold text-gray-900">앨범 제목 수정</h2>
            <p className="mt-1 text-sm text-gray-600">변경할 앨범 제목을 입력해 주세요.</p>
          </div>
          <label className="mt-5 block">
            <span className="sr-only">앨범 제목</span>
            <input
              autoFocus
              value={editTitleDraft}
              onChange={(event) => {
                setEditTitleDraft(event.target.value);
                setEditError('');
              }}
              maxLength={80}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <div className="mt-1 flex min-h-5 items-start justify-between gap-2 text-xs">
            <span className="font-semibold text-error">{editError}</span>
            <span className="shrink-0 text-text-secondary">{editTitleDraft.length}/80</span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setEditingAlbum(null)}
              disabled={editBusy}
              className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={editBusy || !editTitleDraft.trim()}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-primary font-bold text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {editBusy && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
              {editBusy ? '저장 중' : '저장'}
            </button>
          </div>
        </form>
      </div>
    )}
    {deletingAlbum && (
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => {
            if (!deleteBusy) setDeletingAlbum(null);
          }}
          aria-label="앨범 삭제 닫기"
        />
        <section className="relative w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" aria-labelledby="delete-album-title">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-error/10 text-error">
            <Icon icon="mdi:trash-can-outline" className="text-2xl" />
          </span>
          <h2 id="delete-album-title" className="mt-3 text-lg font-bold text-gray-900">앨범 삭제</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            ‘{deletingAlbum.title}’ 앨범을 삭제할까요?
            <br />
            앨범에 담긴 원본 사진과 영상은 삭제되지 않습니다.
          </p>
          {deleteError && <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm font-semibold text-error">{deleteError}</p>}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setDeletingAlbum(null)}
              disabled={deleteBusy}
              className="h-11 flex-1 rounded-xl border border-border font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={removeAlbum}
              disabled={deleteBusy}
              className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-error font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {deleteBusy && <Icon icon="mdi:loading" className="animate-spin text-lg" />}
              {deleteBusy ? '삭제 중' : '삭제'}
            </button>
          </div>
        </section>
      </div>
    )}
  </>
  );
};

export default MyAlbumPage;
