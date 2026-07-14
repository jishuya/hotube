export const memoryMedia = [
  {
    id: 'summer-picnic',
    date: '2026-07-03',
    type: 'photo',
    title: '여름 나들이',
    description: '햇살 좋은 날, 함께 보낸 오후',
    src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'ocean-view',
    date: '2026-07-03',
    type: 'photo',
    title: '바다를 보며',
    description: '파도 소리가 좋았던 순간',
    src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'birthday-cake',
    date: '2026-07-14',
    type: 'photo',
    title: '생일 축하해',
    description: '촛불을 끄기 직전의 설레는 표정',
    src: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'family-walk',
    date: '2026-07-14',
    type: 'photo',
    title: '저녁 산책',
    description: '서늘한 바람을 맞으며 함께 걸었던 길',
    src: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1600&q=85',
  },
  {
    id: 'flower-video',
    date: '2026-07-14',
    type: 'video',
    title: '바람에 흔들리는 꽃',
    description: '여름 오후의 짧은 기록',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'camping-night',
    date: '2026-07-21',
    type: 'photo',
    title: '캠핑의 밤',
    description: '불빛 앞에서 나눈 이야기',
    src: 'https://images.unsplash.com/photo-1475483768296-6163e08872a1?auto=format&fit=crop&w=1600&q=85',
  },
];

export const getMediaByDate = (date) => memoryMedia.filter((item) => item.date === date);

