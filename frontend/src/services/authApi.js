// Firebase Functions URLs
const FUNCTIONS_URL = {
  register: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/registerUser',
  login: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/loginUser',
  getUser: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/getUser',
  updateUser: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/updateUser',
  toggleLike: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/toggleLike',
  markWatched: 'https://asia-northeast3-hotube-9e9dd.cloudfunctions.net/markVideoWatched',
};

// 호칭 목록
export const TITLES = [
  '아빠', '엄마', '수호',
  '친할아버지', '친할머니', '외할아버지', '외할머니',
  '고모', '고모부', '이모', '이모부', '외삼촌', '기타'
];

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
