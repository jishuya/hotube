import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import ChildInfoModal from './ChildInfoModal';
import { getChildProfile, saveChildProfile } from '../../services/childProfileApi';

const DEFAULT_CHILD = {
  name: '김수호',
  nickname: '수호',
  gender: 'male',
  birthday: '2023-10-16',
  profileImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBl38ACm_2q5uSKmstxSAhb8ggchgHK9DuZDHXNj_64EA5Ob1jJaP5M0oQ4GX8BlEUYwrsFj6Le0AuBKKslmIeaHS3k0Jh0yolYS1LjHCwu2xPzrolE-8aRgDMgJtwKQT1CwNibs0mSPlzfIjpF-rojpH1M0PatvSF5Xot8sH70No4nr8N4JBgi17ZXeQqrtek5YGP-eug77bmEtgbrjFGfDT9siZ4rCxYKg9BK1UDifS0zQ_2F1hCTDsyvMoLXWvp85bAzDuRla4fy',
};

const PROFILE_AVATARS = [
  { id: 'grandfather', x: 0, y: 9, label: '할아버지' },
  { id: 'grandmother-curly', x: 25, y: 9, label: '곱슬머리 할머니' },
  { id: 'woman-long', x: 50, y: 9, label: '긴 머리 여성' },
  { id: 'woman-short', x: 75, y: 9, label: '짧은 머리 여성' },
  { id: 'woman-glasses', x: 100, y: 9, label: '안경 쓴 여성' },
  { id: 'man', x: 0, y: 89, label: '성인 남성' },
  { id: 'man-glasses', x: 25, y: 89, label: '안경 쓴 남성' },
  { id: 'grandmother-bob', x: 50, y: 89, label: '단발머리 할머니' },
  { id: 'woman-ponytail', x: 75, y: 89, label: '머리 묶은 여성' },
  { id: 'man-short', x: 100, y: 89, label: '짧은 머리 남성' },
];

const getAvatarStyle = (avatar) => ({
  backgroundImage: "url('/avatars/hotube-family-avatars.png')",
  backgroundPosition: `${avatar.x}% ${avatar.y}%`,
  backgroundSize: '500% auto',
  backgroundRepeat: 'no-repeat',
});

const getDaysSinceBirth = (birthday) => {
  const today = new Date();
  const birthDate = new Date(`${birthday}T00:00:00`);
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(1, Math.floor((currentDate - birthDate) / 86400000) + 1);
};

const Header = ({ isAdmin = false, showSearch = !isAdmin }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [child, setChild] = useState(DEFAULT_CHILD);
  const [showChildInfoModal, setShowChildInfoModal] = useState(false);
  const { user } = useAuth();
  const selectedAvatar = PROFILE_AVATARS.find((avatar) => avatar.id === user?.avatar) || PROFILE_AVATARS[2];

  // URL의 검색어와 input 동기화
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchQuery(q);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    getChildProfile()
      .then((savedChild) => {
        if (active && savedChild) setChild({ ...DEFAULT_CHILD, ...savedChild });
      })
      .catch((error) => console.error('아이 정보 조회 실패:', error));
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    navigate('/');
  };

  const handleChildSave = async (updatedChild) => {
    const savedChild = await saveChildProfile(updatedChild, user?.id);
    setChild({ ...DEFAULT_CHILD, ...savedChild });
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm">
        <header className="flex items-center justify-between whitespace-nowrap px-4 sm:px-10 py-3">
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="HoTube" className="w-8 h-8" />
              <h1 className="text-xl font-bold text-[#181411] dark:text-gray-100">HoTube</h1>
            </Link>
          </div>

          {/* 데스크톱 검색바 (640px 이상에서만 표시) */}
          {showSearch && (
            <div className="hidden sm:flex flex-1 justify-center px-2 sm:px-8 min-w-0">
              <form onSubmit={handleSearch} className="flex w-full max-w-2xl h-10">
                <div className="flex w-full flex-1 items-stretch rounded-full h-full relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-[#181411] dark:text-gray-200 focus:outline-0 focus:ring-2 focus:ring-primary/50 border-none bg-primary/10 dark:bg-primary/20 h-full placeholder:text-[#8a7560] dark:placeholder:text-gray-400 px-3 sm:px-4 rounded-r-none border-r-0 text-sm sm:text-base font-normal leading-normal pr-8"
                    placeholder="Search..."
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="absolute right-14 top-1/2 -translate-y-1/2 text-[#8a7560] hover:text-primary transition-colors"
                    >
                      <Icon icon="mdi:close" className="text-lg" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="text-[#8a7560] hover:text-primary flex border-none bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 items-center justify-center px-3 sm:px-4 rounded-r-full border-l-0 transition-colors"
                  >
                    <Icon icon="mdi:magnify" className="text-xl" />
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="flex gap-2 sm:gap-4 shrink-0 items-center">
            {isAdmin ? (
              <Link
                to="/"
                className="flex items-center justify-center rounded-full size-10 bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
              >
                <Icon icon="lucide:home" className="text-xl" />
              </Link>
            ) : null}
            <Link
              to="/mypage"
              className="size-10 overflow-hidden rounded-full border-2 border-white bg-primary/10 shadow-sm ring-1 ring-primary/20 transition hover:scale-105 hover:ring-primary/50 dark:border-surface"
              aria-label={`${user?.name || '내'} 프로필 보기`}
              title="마이페이지"
            >
              <span
                className="block size-full"
                role="img"
                aria-label={selectedAvatar.label}
                style={getAvatarStyle(selectedAvatar)}
              />
            </Link>
          </div>
        </header>

        <div
          className="mx-4 mb-2 flex max-w-2xl items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/15 via-primary/10 to-amber-100/70 px-3 py-1.5 shadow-sm transition hover:border-primary/40 hover:shadow-md sm:mx-10 sm:px-4 dark:to-primary/5 md:mx-auto"
        >
            <div className="relative shrink-0">
              <img
                src={child.profileImage}
                alt={`${child.nickname || child.name} 대표 사진`}
                className="size-12 rounded-full border-2 border-white object-cover shadow-sm dark:border-surface"
              />
              <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-white ring-2 ring-white dark:ring-surface">
                <Icon icon="mdi:heart" className="text-[11px]" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-secondary">{child.nickname || child.name}와 함께한 시간</p>
              <p className="truncate text-lg font-extrabold leading-tight text-text-primary sm:text-xl">
                태어난 지 <span className="text-primary">{getDaysSinceBirth(child.birthday)}일째</span>
              </p>
            </div>
            <button type="button" onClick={() => setShowChildInfoModal(true)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-white/70 hover:text-primary" aria-label="아이 정보 수정" title="아이 정보 수정">
              <Icon icon="mdi:dots-vertical" className="text-xl" />
            </button>
        </div>

      {/* 모바일 검색바 (640px 미만에서만 표시) */}
      {showSearch && (
        <div className="sm:hidden px-4">
          <form onSubmit={handleSearch} className="flex w-full h-10">
            <div className="flex w-full flex-1 items-stretch rounded-full h-full relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-[#181411] dark:text-gray-200 focus:outline-0 focus:ring-2 focus:ring-primary/50 border-none bg-primary/10 dark:bg-primary/20 h-full placeholder:text-[#8a7560] dark:placeholder:text-gray-400 px-4 rounded-r-none border-r-0 text-base font-normal leading-normal pr-10"
                placeholder="Search..."
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-14 top-1/2 -translate-y-1/2 text-[#8a7560] hover:text-primary transition-colors"
                >
                  <Icon icon="mdi:close" className="text-lg" />
                </button>
              )}
              <button
                type="submit"
                className="text-[#8a7560] hover:text-primary flex border-none bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 items-center justify-center px-4 rounded-r-full border-l-0 transition-colors"
              >
                <Icon icon="mdi:magnify" className="text-xl" />
              </button>
            </div>
          </form>
        </div>
      )}
      </div>
      {showChildInfoModal && (
        <ChildInfoModal
          isOpen
          onClose={() => setShowChildInfoModal(false)}
          child={child}
          onSave={handleChildSave}
        />
      )}
    </>
  );
};

export default Header;
