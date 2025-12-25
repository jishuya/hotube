// Firebase Functions URLs
const FUNCTIONS_URL = {
  register: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/registerUser',
  login: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/loginUser',
  getUser: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/getUser',
  updateUser: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/updateUser',
  changePassword: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/changePassword',
  toggleLike: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/toggleLike',
  markWatched: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/markVideoWatched',
};

// 사용자 목록 (userId: 영문ID, label: 호칭)
export const USERS = [
  { userId: 'dad', label: '아빠' },
  { userId: 'mom', label: '엄마' },
  { userId: 'suho', label: '수호' },
  { userId: 'chinhalbi', label: '친할아버지' },
  { userId: 'chinhalmi', label: '친할머니' },
  { userId: 'oehalbi', label: '외할아버지' },
  { userId: 'oehalmi', label: '외할머니' },
  { userId: 'gomo', label: '고모' },
  { userId: 'gomobu', label: '고모부' },
  { userId: 'imo', label: '이모' },
  { userId: 'imobu', label: '이모부' },
  { userId: 'samchon', label: '외삼촌' },
  { userId: 'etc', label: '기타' },
];

// 호칭 목록 (하위 호환성)
export const TITLES = USERS.map(u => u.label);

// 카테고리 목록
export const CATEGORIES = [
  { value: 'dad', label: '아빠가족' },
  { value: 'mom', label: '엄마가족' },
  { value: 'etc', label: '기타' },
];

// 회원가입
export const registerUser = async (userData) => {
  const response = await fetch(FUNCTIONS_URL.register, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '회원가입에 실패했습니다');
  }

  return data;
};

// 로그인
export const loginUser = async (credentials) => {
  const response = await fetch(FUNCTIONS_URL.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '로그인에 실패했습니다');
  }

  return data;
};

// 사용자 정보 조회
export const getUser = async (userId) => {
  const response = await fetch(`${FUNCTIONS_URL.getUser}/${userId}`);

  if (!response.ok) {
    throw new Error('사용자 정보를 가져오는데 실패했습니다');
  }

  return response.json();
};

// 사용자 정보 수정
export const updateUser = async (userId, userData) => {
  const response = await fetch(`${FUNCTIONS_URL.updateUser}/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '사용자 정보 수정에 실패했습니다');
  }

  return data;
};

// 비밀번호 변경
export const changePassword = async (userId, currentPassword, newPassword) => {
  const response = await fetch(`${FUNCTIONS_URL.changePassword}/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '비밀번호 변경에 실패했습니다');
  }

  return data;
};

// 좋아요 토글
export const toggleLike = async (userId, videoId) => {
  const response = await fetch(FUNCTIONS_URL.toggleLike, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, videoId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '좋아요 처리에 실패했습니다');
  }

  return data;
};

// 시청 기록 추가
export const markVideoWatched = async (userId, videoId) => {
  const response = await fetch(FUNCTIONS_URL.markWatched, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, videoId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '시청 기록 추가에 실패했습니다');
  }

  return data;
};
