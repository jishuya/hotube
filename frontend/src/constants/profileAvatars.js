export const PROFILE_AVATARS = [
  { id: 'grandfather', x: 1.555, y: 3.765, label: '할아버지' },
  { id: 'grandfather-parted', x: 25.179, y: 4.218, label: '가르마 머리 할아버지' },
  { id: 'grandmother-curly', x: 49.252, y: 3.916, label: '곱슬머리 할머니' },
  { id: 'grandmother-bob', x: 72.877, y: 4.067, label: '단발머리 할머니' },
  { id: 'grandmother-braided', x: 96.8, y: 3.916, label: '땋은 올림머리 할머니' },
  { id: 'man', x: 1.106, y: 33.531, label: '성인 남성' },
  { id: 'man-glasses', x: 24.731, y: 33.682, label: '안경 쓴 남성' },
  { id: 'man-short', x: 48.953, y: 33.833, label: '뒤로 넘긴 머리 남성' },
  { id: 'man-wavy', x: 72.877, y: 33.682, label: '웨이브 머리 남성' },
  { id: 'man-buzz', x: 96.651, y: 33.984, label: '스포츠머리 남성' },
  { id: 'man-medium', x: 1.106, y: 63.901, label: '중간 길이 머리 남성' },
  { id: 'woman-long', x: 24.731, y: 63.901, label: '긴 머리 여성' },
  { id: 'woman-short', x: 48.953, y: 63.75, label: '짧은 머리 여성' },
  { id: 'woman-glasses', x: 73.026, y: 63.901, label: '안경 쓴 여성' },
  { id: 'woman-ponytail', x: 96.651, y: 63.901, label: '머리 묶은 여성' },
  { id: 'woman-bun', x: 0.957, y: 93.062, label: '올림머리 여성' },
  { id: 'preschool-boy', x: 24.88, y: 93.364, label: '세 살 남자아이' },
  { id: 'toddler-boy', x: 48.505, y: 93.213, label: '두 살 남자아이' },
  { id: 'infant-girl', x: 72.279, y: 93.213, label: '여섯 달 여자아이' },
  { id: 'toddler-girl', x: 96.202, y: 93.213, label: '한 살 여자아이' },
];

export const AVATAR_POSITIONS = Object.fromEntries(
  PROFILE_AVATARS.map(({ id, x, y }) => [id, [x, y]]),
);

export const getAvatarStyle = (avatar) => ({
  backgroundImage: "url('/avatars/hotube-family-avatars-v2.png')",
  backgroundPosition: `${avatar.x}% ${avatar.y}%`,
  backgroundSize: '500% 480%',
  backgroundRepeat: 'no-repeat',
});
