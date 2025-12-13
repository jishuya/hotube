import { createContext, useContext, useState, useEffect } from 'react';
import { getUser } from '../services/authApi';

const AuthContext = createContext(null);

const STORAGE_KEY = 'hotube_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 초기 로딩 시 localStorage에서 사용자 정보 복원
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem(STORAGE_KEY);
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          // 서버에서 최신 정보 가져오기
          const freshUser = await getUser(userData.id);
          setUser(freshUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(freshUser));
        }
      } catch (error) {
        console.error('사용자 정보 로드 실패:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // 로그인
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  };

  // 로그아웃
  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // 사용자 정보 업데이트 (좋아요, 시청기록 등)
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
  };

  // 좋아요 상태 확인
  const isLiked = (videoId) => {
    return user?.likedVideos?.includes(videoId) || false;
  };

  // 시청 여부 확인
  const isWatched = (videoId) => {
    return user?.watchedVideos?.includes(videoId) || false;
  };

  // 좋아요 토글 후 로컬 상태 업데이트
  const toggleLikeLocal = (videoId) => {
    if (!user) return;

    const likedVideos = user.likedVideos || [];
    const newLikedVideos = likedVideos.includes(videoId)
      ? likedVideos.filter(id => id !== videoId)
      : [...likedVideos, videoId];

    updateUser({ likedVideos: newLikedVideos });
  };

  // 시청 기록 추가 후 로컬 상태 업데이트
  const markWatchedLocal = (videoId) => {
    if (!user) return;

    const watchedVideos = user.watchedVideos || [];
    if (!watchedVideos.includes(videoId)) {
      updateUser({ watchedVideos: [...watchedVideos, videoId] });
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    isLiked,
    isWatched,
    toggleLikeLocal,
    markWatchedLocal,
    isAdmin: user?.role === 'admin',
    isLoggedIn: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
