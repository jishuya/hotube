import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import { favoriteMedia, getAlbumMedia, myAlbums } from '../data/myAlbums';

const MyAlbumPage = () => {
  const [albums, setAlbums] = useState(myAlbums);
  const [openMenuId, setOpenMenuId] = useState(null);

  const renameAlbum = (album) => {
    const title = window.prompt('새 앨범 제목을 입력해 주세요.', album.title)?.trim();
    if (title) {
      setAlbums((current) => current.map((item) => (
        item.id === album.id ? { ...item, title } : item
      )));
    }
    setOpenMenuId(null);
  };

  const deleteAlbum = (album) => {
    if (window.confirm(`‘${album.title}’ 앨범을 삭제할까요?`)) {
      setAlbums((current) => current.filter((item) => item.id !== album.id));
    }
    setOpenMenuId(null);
  };

  return (
  <>
    <Header showSearch={false} />
    <main className="min-h-screen bg-background px-4 pb-16 text-text-primary">
      <div className="mx-auto max-w-container">
        <section aria-labelledby="favorites-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon icon="mdi:heart" className="text-xl" />
              </span>
              <h2 id="favorites-title" className="text-xl font-bold">즐겨찾기</h2>
            </div>
            <Link to="/my-album/favorites" className="shrink-0 text-sm font-bold text-primary hover:underline">
              더보기
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="즐겨찾기 미리보기">
            {favoriteMedia.slice(0, 6).map((item) => (
              <Link
                key={item.id}
                to={`/media/${item.id}`}
                className="group relative aspect-square overflow-hidden rounded-xl bg-surface shadow-sm"
              >
                <img src={item.thumbnail || item.src} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-primary shadow-sm backdrop-blur-sm">
                  <Icon icon="mdi:heart" className="text-base" />
                </span>
                {item.type === 'video' && (
                  <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-lg">
                    <Icon icon="mdi:play-circle" className="text-4xl" />
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="my-albums-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 id="my-albums-title" className="text-xl font-bold">마이 앨범</h2>
            </div>
            <button type="button" className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-primary/90" title="앨범 만들기 기능은 준비 중입니다">
              <Icon icon="mdi:plus" className="text-lg" />
              새 앨범
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {albums.map((album) => {
              const albumMedia = getAlbumMedia(album);
              const cover = albumMedia[0];
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
                        onClick={() => renameAlbum(album)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-primary/10"
                      >
                        <Icon icon="mdi:pencil-outline" />
                        제목 수정
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteAlbum(album)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-error hover:bg-error/10"
                      >
                        <Icon icon="mdi:trash-can-outline" />
                        앨범 삭제
                      </button>
                    </div>
                  )}
                  <Link to={`/my-album/${album.id}`} className="relative block aspect-square overflow-hidden rounded-xl bg-primary/10">
                    {cover ? (
                      <img src={cover.thumbnail || cover.src} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <Icon icon="mdi:image-multiple-outline" className="absolute inset-0 m-auto text-4xl text-primary/40" />
                    )}
                  </Link>
                  <div className="px-1 pb-2 pt-3">
                    <div className="flex items-center gap-1">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">
                        <Link to={`/my-album/${album.id}`} className="hover:text-primary">{album.title}</Link>
                      </h3>
                      <span className="shrink-0 text-xs font-semibold text-text-secondary">{albumMedia.length}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  </>
  );
};

export default MyAlbumPage;
