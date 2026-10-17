import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import { toggleLike } from '../../services/authApi';
import { toggleFavorite } from '../../services/videoApi';

export default function MediaPreviewAction({ mediaId, kind = 'like', initiallyActive = false }) {
  const { user, isLiked, toggleLikeLocal } = useAuth();
  const [favorited, setFavorited] = useState(initiallyActive);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const authRef = useRef({ isLiked, toggleLikeLocal });
  const favorite = kind === 'favorite';
  const active = pending ?? (favorite ? favorited : isLiked(mediaId));
  const label = favorite ? '즐겨찾기' : '좋아요';

  useEffect(() => {
    authRef.current = { isLiked, toggleLikeLocal };
  }, [isLiked, toggleLikeLocal]);

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user || saving.current) return;
    saving.current = true;
    setError('');
    setPending(!active);
    try {
      if (favorite) {
        const result = await toggleFavorite(user.id, mediaId);
        setFavorited(result.favorited);
      } else {
        const result = await toggleLike(user.id, mediaId);
        if (authRef.current.isLiked(mediaId) !== result.liked) {
          authRef.current.toggleLikeLocal(mediaId);
        }
      }
    } catch {
      setError(`${label}를 저장하지 못했어요. 다시 눌러주세요.`);
    } finally {
      saving.current = false;
      setPending(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={(event) => event.stopPropagation()}
        disabled={!user || pending !== null}
        aria-label={`${label}${active ? ' 취소' : ''}`}
        aria-pressed={active}
        aria-busy={pending !== null}
        className="absolute right-0 top-0 z-10 flex size-11 items-center justify-center bg-transparent text-white transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:cursor-wait"
      >
        <Icon
          icon={favorite ? (active ? 'mdi:bookmark' : 'mdi:bookmark-outline') : (active ? 'mdi:heart' : 'mdi:heart-outline')}
          className={`translate-x-1.5 -translate-y-1.5 text-base ${active ? favorite ? 'text-yellow-400' : 'text-rose-400' : ''}`}
          aria-hidden="true"
        />
      </button>
      {error && <p role="alert" className="pointer-events-none absolute inset-x-2 bottom-10 z-20 rounded-lg bg-black/80 p-2 text-xs text-white">{error}</p>}
    </>
  );
}
