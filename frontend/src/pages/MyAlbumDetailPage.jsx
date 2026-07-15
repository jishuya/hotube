import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/common/Header';
import { favoriteMedia, getAlbumMedia, getMyAlbumById } from '../data/myAlbums';

const MyAlbumDetailPage = () => {
  const { albumId } = useParams();
  const isFavorites = albumId === 'favorites';
  const album = isFavorites ? null : getMyAlbumById(albumId);
  const media = isFavorites ? favoriteMedia : getAlbumMedia(album);
  const [editedTitle, setEditedTitle] = useState(album?.title || '');

  if (!isFavorites && !album) {
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

  const title = isFavorites ? '즐겨찾기' : editedTitle;

  const renameAlbum = () => {
    const nextTitle = window.prompt('새 앨범 제목을 입력해 주세요.', title)?.trim();
    if (nextTitle) setEditedTitle(nextTitle);
  };

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-background px-4 pb-16 text-text-primary">
        <div className="mx-auto max-w-container">
          <header className="mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-1">
                <h1 className="truncate text-2xl font-bold sm:text-3xl">{title}</h1>
                {!isFavorites && (
                  <button
                    type="button"
                    onClick={renameAlbum}
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
          </header>

          {media.length > 0 ? (
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={`${title} 사진과 영상`}>
              {media.map((item) => (
                <Link key={item.id} to={`/media/${item.id}`} className="group relative aspect-square overflow-hidden rounded-xl bg-surface shadow-sm">
                  <img src={item.thumbnail || item.src} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {isFavorites && (
                    <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm">
                      <Icon icon="mdi:heart" />
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      {item.type === 'video' && <Icon icon="mdi:play-circle" className="shrink-0 text-2xl" />}
                    </div>
                  </div>
                </Link>
              ))}
            </section>
          ) : (
            <section className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl bg-surface text-center shadow-sm">
              <Icon icon="mdi:image-plus-outline" className="mb-3 text-5xl text-primary/40" />
              <h2 className="text-lg font-bold">아직 담긴 사진이 없어요</h2>
              <p className="mt-2 text-sm text-text-secondary">좋아하는 순간을 이 앨범에 추가해 보세요.</p>
            </section>
          )}
        </div>
      </main>
    </>
  );
};

export default MyAlbumDetailPage;
