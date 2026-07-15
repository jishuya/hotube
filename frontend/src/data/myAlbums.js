import { memoryMedia } from './memoryMedia';

const mediaById = Object.fromEntries(memoryMedia.map((item) => [item.id, item]));

export const favoriteMedia = memoryMedia;

export const myAlbums = [
  {
    id: 'summer-days',
    title: '우리의 여름',
    description: '햇살 아래 함께 보낸 여름날의 기록',
    mediaIds: ['summer-picnic', 'ocean-view', 'flower-video'],
  },
  {
    id: 'family-moments',
    title: '가족과 함께',
    description: '오래 간직하고 싶은 가족의 순간들',
    mediaIds: ['birthday-cake', 'family-walk', 'summer-picnic'],
  },
  {
    id: 'little-happiness',
    title: '소소한 행복',
    description: '평범해서 더 소중한 일상의 장면',
    mediaIds: ['flower-video', 'camping-night'],
  },
  {
    id: 'travel-memories',
    title: '여행의 기억',
    description: '다시 떠나고 싶은 곳에서 남긴 추억',
    mediaIds: ['ocean-view', 'camping-night'],
  },
];

export const getAlbumMedia = (album) => (
  album?.mediaIds.map((id) => mediaById[id]).filter(Boolean) ?? []
);

export const getMyAlbumById = (albumId) => myAlbums.find((album) => album.id === albumId);
