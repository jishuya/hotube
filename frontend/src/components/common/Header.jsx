import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import ChildInfoModal from './ChildInfoModal';
import { getChildProfile, saveChildProfile } from '../../services/childProfileApi';
import { getSupportRequest, getSupportRequests, markSupportRequestRead } from '../../services/supportApi';
import { getCalendarMedia, toMemoryMedia } from '../../services/videoApi';
import { markAllVideosWatched, markVideoWatched } from '../../services/authApi';
import { dismissMediaNotifications, getInternalNotifications, getOrCreateNotificationBaseline, markInternalNotificationRead } from '../../services/pushApi';
import { getAvatarStyle, PROFILE_AVATARS } from '../../constants/profileAvatars';

const DEFAULT_CHILD = {
  name: '김수호',
  nickname: '수호',
  gender: 'male',
  birthday: '2023-10-16',
  profileImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBl38ACm_2q5uSKmstxSAhb8ggchgHK9DuZDHXNj_64EA5Ob1jJaP5M0oQ4GX8BlEUYwrsFj6Le0AuBKKslmIeaHS3k0Jh0yolYS1LjHCwu2xPzrolE-8aRgDMgJtwKQT1CwNibs0mSPlzfIjpF-rojpH1M0PatvSF5Xot8sH70No4nr8N4JBgi17ZXeQqrtek5YGP-eug77bmEtgbrjFGfDT9siZ4rCxYKg9BK1UDifS0zQ_2F1hCTDsyvMoLXWvp85bAzDuRla4fy',
};

const getAgeSinceBirth = (birthday) => {
  const today = new Date();
  const birthDate = new Date(`${birthday}T00:00:00`);
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (Number.isNaN(birthDate.getTime()) || birthDate > currentDate) {
    return { months: 0, days: 0 };
  }

  let months = (currentDate.getFullYear() - birthDate.getFullYear()) * 12
    + currentDate.getMonth() - birthDate.getMonth();
  const getMonthAnniversary = (monthCount) => {
    const anniversary = new Date(birthDate.getFullYear(), birthDate.getMonth() + monthCount, 1);
    const lastDayOfMonth = new Date(
      anniversary.getFullYear(),
      anniversary.getMonth() + 1,
      0,
    ).getDate();
    anniversary.setDate(Math.min(birthDate.getDate(), lastDayOfMonth));
    return anniversary;
  };

  let monthAnniversary = getMonthAnniversary(months);
  if (monthAnniversary > currentDate) {
    months -= 1;
    monthAnniversary = getMonthAnniversary(months);
  }

  const days = Math.floor((currentDate - monthAnniversary) / 86400000);
  return { months, days };
};

const getChildGivenName = (name, nickname) => {
  const normalizedName = String(name || '').trim();
  if (normalizedName.length >= 3) return normalizedName.slice(1);
  return normalizedName || nickname;
};

const Header = ({ isAdmin = false, showSearch = !isAdmin, showChildBanner = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [child, setChild] = useState(DEFAULT_CHILD);
  const [showChildInfoModal, setShowChildInfoModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [supportRequests, setSupportRequests] = useState([]);
  const [mediaNotifications, setMediaNotifications] = useState([]);
  const [internalNotifications, setInternalNotifications] = useState([]);
  const [supportNotificationsLoadedFor, setSupportNotificationsLoadedFor] = useState(null);
  const [mediaNotificationsLoadedFor, setMediaNotificationsLoadedFor] = useState(null);
  const [internalNotificationsLoadedFor, setInternalNotificationsLoadedFor] = useState(null);
  const [notificationError, setNotificationError] = useState('');
  const [mediaNotificationError, setMediaNotificationError] = useState('');
  const [markingAllMedia, setMarkingAllMedia] = useState(false);
  const [selectedSupport, setSelectedSupport] = useState(null);
  const [supportDetailLoading, setSupportDetailLoading] = useState(false);
  const { user, isAdmin: authIsAdmin, markAllWatchedLocal } = useAuth();
  const selectedAvatar = PROFILE_AVATARS.find((avatar) => avatar.id === user?.avatar) || PROFILE_AVATARS[2];
  const notificationBaseline = useMemo(
    () => getOrCreateNotificationBaseline(user?.id),
    [user?.id],
  );
  const unreadSupportRequests = supportRequests.filter((request) => request.status === 'received');
  const unreadSupportCount = unreadSupportRequests.length;
  const notificationMedia = mediaNotifications.filter((media) => {
    if (!notificationBaseline || !media.createdAt) return true;
    return new Date(media.createdAt).getTime() > new Date(notificationBaseline).getTime();
  });
  const unreadMediaGroups = [...notificationMedia.reduce((groups, media) => {
    const groupId = media.uploadBatchId || media.id;
    const existing = groups.get(groupId);
    if (existing) {
      existing.mediaIds.push(media.id);
      existing.mediaItems.push(media);
      existing.count += 1;
    } else {
      groups.set(groupId, {
        ...media,
        groupId,
        mediaIds: [media.id],
        mediaItems: [media],
        count: 1,
      });
    }
    return groups;
  }, new Map()).values()].filter((group) => (
    !group.mediaIds.some((mediaId) => user?.watchedVideos?.includes(mediaId))
  ));
  const unreadMedia = unreadMediaGroups.flatMap((group) => group.mediaItems);
  const unreadMediaCount = unreadMediaGroups.length;
  const auxiliaryNotificationCount = unreadSupportCount + internalNotifications.length;
  const hasUnreadNotifications = unreadMediaCount > 0 || auxiliaryNotificationCount > 0;
  const notificationCountsLoaded = mediaNotificationsLoadedFor === user?.id
    && internalNotificationsLoadedFor === user?.id
    && (!authIsAdmin || supportNotificationsLoadedFor === user?.id);
  const childAge = getAgeSinceBirth(child.birthday);

  useEffect(() => {
    if (!user?.id || !notificationCountsLoaded) return;
    const syncAppBadge = async () => {
      try {
        if (unreadMediaCount > 0 && 'setAppBadge' in navigator) {
          await navigator.setAppBadge(unreadMediaCount);
        } else if (unreadMediaCount === 0 && 'clearAppBadge' in navigator) {
          await navigator.clearAppBadge();
        }
        const registration = await navigator.serviceWorker?.getRegistration();
        registration?.active?.postMessage({
          type: 'SYNC_APP_BADGE',
          badgeCount: unreadMediaCount,
          badgeVersion: Date.now(),
        });
      } catch (error) {
        console.error('홈 화면 앱 배지 동기화 실패:', error);
      }
    };
    syncAppBadge();
  }, [notificationCountsLoaded, unreadMediaCount, user?.id]);

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

  useEffect(() => {
    if (!authIsAdmin || !user?.id) {
      setSupportRequests([]);
      setSupportNotificationsLoadedFor(null);
      return undefined;
    }
    let active = true;
    const loadNotifications = () => {
      getSupportRequests(user.id)
        .then((requests) => {
          if (active) {
            setSupportRequests(requests);
            setSupportNotificationsLoadedFor(user.id);
            setNotificationError('');
          }
        })
        .catch((error) => {
          if (active) setNotificationError(error.message);
        });
    };
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 15000);
    window.addEventListener('focus', loadNotifications);
    window.addEventListener('support-status-changed', loadNotifications);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadNotifications);
      window.removeEventListener('support-status-changed', loadNotifications);
    };
  }, [authIsAdmin, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setMediaNotifications([]);
      setMediaNotificationsLoadedFor(null);
      return undefined;
    }
    let active = true;
    const loadMediaNotifications = () => {
      getCalendarMedia()
        .then(({ unreadMedia }) => {
          if (active) {
            setMediaNotifications(unreadMedia.map(toMemoryMedia));
            setMediaNotificationsLoadedFor(user.id);
            setMediaNotificationError('');
          }
        })
        .catch((error) => {
          if (active) setMediaNotificationError(error.message || '미디어 알림을 불러오지 못했습니다');
        });
    };
    loadMediaNotifications();
    const intervalId = window.setInterval(loadMediaNotifications, 15000);
    window.addEventListener('focus', loadMediaNotifications);
    window.addEventListener('hotube:media-updated', loadMediaNotifications);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadMediaNotifications);
      window.removeEventListener('hotube:media-updated', loadMediaNotifications);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setInternalNotifications([]);
      setInternalNotificationsLoadedFor(null);
      return undefined;
    }
    let active = true;
    const loadInternalNotifications = () => getInternalNotifications()
      .then((items) => {
        if (active) {
          setInternalNotifications(items);
          setInternalNotificationsLoadedFor(user.id);
          setNotificationError('');
        }
      })
      .catch((error) => {
        if (active) setNotificationError(error.message);
      });
    loadInternalNotifications();
    const intervalId = window.setInterval(loadInternalNotifications, 15000);
    window.addEventListener('focus', loadInternalNotifications);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadInternalNotifications);
    };
  }, [user?.id]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/home?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/home');
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    navigate('/home');
  };

  const handleChildSave = async (updatedChild) => {
    const savedChild = await saveChildProfile(updatedChild, user?.id);
    setChild({ ...DEFAULT_CHILD, ...savedChild });
  };

  const handleNotificationClick = async (request) => {
    setShowNotifications(false);
    setSupportDetailLoading(true);
    setNotificationError('');
    try {
      const [detail, updated] = await Promise.all([
        getSupportRequest(request.id, user.id),
        request.status === 'received'
          ? markSupportRequestRead(request.id, user.id)
          : Promise.resolve({ status: request.status }),
      ]);
      setSelectedSupport({ ...detail, status: updated.status });
      setSupportRequests((current) => current.map((item) => (
        item.id === request.id ? { ...item, status: updated.status } : item
      )));
    } catch (error) {
      setNotificationError(error.message);
      setShowNotifications(true);
    } finally {
      setSupportDetailLoading(false);
    }
  };

  const handleMediaNotificationClick = async (media) => {
    setShowNotifications(false);
    try {
      await markVideoWatched(user.id, media.id);
      markAllWatchedLocal([media.id]);
      await dismissMediaNotifications(media.mediaIds);
    } catch (error) {
      setMediaNotificationError(error.message || '미디어 알림을 확인 처리하지 못했습니다');
    }
    const dateQuery = media.date ? `?date=${encodeURIComponent(media.date)}` : '';
    navigate(`/media/${encodeURIComponent(media.id)}${dateQuery}`, {
      state: { returnTo: media.date ? `/calendar?month=${media.date.slice(0, 7)}` : '/calendar' },
    });
  };

  const handleInternalNotificationClick = async (notification) => {
    setNotificationError('');
    try {
      await markInternalNotificationRead(notification.id);
      setInternalNotifications((current) => current.filter((item) => item.id !== notification.id));
      setShowNotifications(false);
      navigate(notification.url || '/');
    } catch (error) {
      setNotificationError(error.message || '알림을 확인 처리하지 못했습니다');
    }
  };

  const handleMarkAllMediaRead = async () => {
    if (!user?.id || unreadMedia.length === 0 || markingAllMedia) return;
    setMarkingAllMedia(true);
    setMediaNotificationError('');
    try {
      await markAllVideosWatched(user.id);
      const unreadMediaIds = unreadMedia.map((media) => media.id);
      markAllWatchedLocal(unreadMediaIds);
      await dismissMediaNotifications(unreadMediaIds);
    } catch (error) {
      setMediaNotificationError(error.message || '전체 미디어 확인 처리에 실패했습니다');
    } finally {
      setMarkingAllMedia(false);
    }
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

          <div className="relative flex gap-2 sm:gap-4 shrink-0 items-center">
            {isAdmin ? (
              <Link
                to="/"
                className="flex items-center justify-center rounded-full size-10 bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
              >
                <Icon icon="lucide:home" className="text-xl" />
              </Link>
            ) : null}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications((current) => !current)}
                  className="relative flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                  aria-label="알림"
                  aria-expanded={showNotifications}
                  title="알림"
                >
                  <Icon icon={hasUnreadNotifications ? 'mdi:bell-ring-outline' : 'mdi:bell-outline'} className="text-xl" />
                  {unreadMediaCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full bg-error px-1 text-[10px] font-extrabold leading-5 text-white ring-2 ring-background">
                      {unreadMediaCount > 99 ? '99+' : unreadMediaCount}
                    </span>
                  ) : auxiliaryNotificationCount > 0 ? (
                    <span className="absolute right-0 top-0 size-2.5 rounded-full bg-error ring-2 ring-background" aria-label="새 댓글 또는 문의 알림" />
                  ) : null}
                </button>
                {showNotifications && (
                  <section className="fixed left-4 right-4 top-16 z-30 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[22rem]" aria-label="알림 목록">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div>
                        <h2 className="font-bold">알림</h2>
                        <p className="text-xs text-text-secondary">
                          {hasUnreadNotifications
                            ? `${unreadMediaCount ? `새 미디어 ${unreadMediaCount}개` : ''}${unreadMediaCount && auxiliaryNotificationCount ? ' · ' : ''}${auxiliaryNotificationCount ? `댓글·문의 ${auxiliaryNotificationCount}건` : ''}`
                            : '새로운 알림이 없어요'}
                        </p>
                      </div>
                      <button type="button" onClick={() => setShowNotifications(false)} className="flex size-8 items-center justify-center rounded-full hover:bg-primary/10" aria-label="알림 닫기">
                        <Icon icon="mdi:close" className="text-lg" />
                      </button>
                    </div>
                    <div className="max-h-[min(65vh,32rem)] overflow-y-auto">
                      {notificationError && (
                        <p className="m-3 rounded-xl bg-error/10 px-3 py-2 text-sm font-semibold text-error">{notificationError}</p>
                      )}
                      {mediaNotificationError && (
                        <p className="m-3 rounded-xl bg-error/10 px-3 py-2 text-sm font-semibold text-error">{mediaNotificationError}</p>
                      )}
                      {!notificationError && !mediaNotificationError && !hasUnreadNotifications && (
                        <div className="px-4 py-10 text-center text-sm text-text-secondary">
                          <Icon icon="mdi:bell-check-outline" className="mx-auto mb-2 text-4xl text-primary/50" />
                          확인하지 않은 알림이 없어요.
                        </div>
                      )}
                      {internalNotifications.length > 0 && (
                        <div>
                          <h3 className="border-b border-border bg-background px-4 py-2 text-xs font-bold text-text-secondary">댓글 및 문의</h3>
                          {internalNotifications.map((notification) => (
                            <button key={`internal-${notification.id}`} type="button" onClick={() => handleInternalNotificationClick(notification)} className="flex w-full items-center gap-3 border-b border-border bg-primary/5 px-4 py-3 text-left transition hover:bg-primary/10">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Icon icon={notification.type === 'comment' ? 'mdi:comment-text-outline' : 'mdi:message-check-outline'} className="text-xl" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{notification.title}</span>
                                <span className="mt-0.5 block truncate text-xs text-text-secondary">{notification.body}</span>
                              </span>
                              <span className="size-2 shrink-0 rounded-full bg-error" aria-label="미확인" />
                            </button>
                          ))}
                        </div>
                      )}
                      {unreadMediaGroups.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
                            <h3 className="text-xs font-bold text-text-secondary">새 미디어</h3>
                            <button
                              type="button"
                              onClick={handleMarkAllMediaRead}
                              disabled={markingAllMedia}
                              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-50"
                            >
                              {markingAllMedia && <Icon icon="mdi:loading" className="animate-spin text-sm" />}
                              {markingAllMedia ? '처리 중' : '모두 확인'}
                            </button>
                          </div>
                          {unreadMediaGroups.map((media) => (
                            <button
                              key={`media-${media.groupId}`}
                              type="button"
                              onClick={() => handleMediaNotificationClick(media)}
                              className="flex w-full items-center gap-3 border-b border-border bg-primary/5 px-4 py-3 text-left transition hover:bg-primary/10"
                            >
                              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-black/5">
                                {media.thumbnail || media.type === 'photo' ? (
                                  <img src={media.thumbnail || media.src} alt="" className="size-full object-cover" />
                                ) : (
                                  <Icon icon="mdi:video-outline" className="absolute inset-0 m-auto text-2xl text-primary" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">
                                  {media.count > 1 ? `새 미디어 ${media.count}개가 등록됐어요` : media.title}
                                </span>
                                {media.date && <span className="mt-0.5 block text-xs text-text-secondary">{media.date}</span>}
                              </span>
                              <span className="size-2 shrink-0 rounded-full bg-error" aria-label="미확인" />
                            </button>
                          ))}
                        </div>
                      )}
                      {authIsAdmin && unreadSupportRequests.length > 0 && (
                        <div>
                          <h3 className="border-b border-border bg-background px-4 py-2 text-xs font-bold text-text-secondary">고객의 소리</h3>
                          {unreadSupportRequests.map((request) => (
                            <button
                              key={`support-${request.id}`}
                              type="button"
                              onClick={() => handleNotificationClick(request)}
                              className="flex w-full items-center gap-2 border-b border-border bg-primary/5 px-4 py-3 text-left transition hover:bg-primary/10"
                            >
                              <span className="size-2 shrink-0 rounded-full bg-error" aria-label="미확인" />
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {request.message.split(/\r?\n/)[0]}
                              </span>
                              <Icon icon="mdi:chevron-right" className="shrink-0 text-lg text-text-secondary" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
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

        {showChildBanner && (
          <div
            className="mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-3xl items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/15 via-primary/10 to-amber-100/70 px-3 py-1.5 shadow-sm transition hover:border-primary/40 hover:shadow-md sm:px-4 dark:to-primary/5"
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
              <p className="truncate text-xs font-semibold text-text-secondary">
                {getChildGivenName(child.name, child.nickname)}와 함께한{' '}
                <span className="text-orange-500">{childAge.months}개월 {childAge.days}일</span>
              </p>
              <p className="whitespace-nowrap text-base font-extrabold leading-tight text-text-primary sm:text-[22px]">
                모든 순간이 선물이야
              </p>
            </div>
            <button type="button" onClick={() => setShowChildInfoModal(true)} className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-white/70 hover:text-primary" aria-label="아이 정보 수정" title="아이 정보 수정">
              <Icon icon="mdi:dots-vertical" className="text-xl" />
            </button>
          </div>
        )}

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
      {supportDetailLoading && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4" role="status" aria-label="접수 내용 불러오는 중">
          <div className="flex items-center gap-2 rounded-2xl bg-surface px-5 py-4 font-bold shadow-xl">
            <Icon icon="mdi:loading" className="animate-spin text-2xl text-primary" />
            접수 내용을 불러오는 중...
          </div>
        </div>
      )}
      {selectedSupport && !supportDetailLoading && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setSelectedSupport(null)} aria-label="상세 내용 닫기" />
          <section className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="support-detail-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${selectedSupport.request_type === 'bug' ? 'bg-error/10 text-error' : 'bg-primary/15 text-primary'}`}>
                  {selectedSupport.request_type === 'bug' ? '오류 리포트' : '문의사항'}
                </span>
                <h2 id="support-detail-title" className="mt-2 text-xl font-bold">접수 내용</h2>
              </div>
              <button type="button" onClick={() => setSelectedSupport(null)} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-primary/10" aria-label="상세 내용 닫기">
                <Icon icon="mdi:close" className="text-xl" />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 rounded-xl bg-background p-4 text-sm">
              <dt className="font-semibold text-text-secondary">작성자</dt>
              <dd className="font-bold">{selectedSupport.user_name || selectedSupport.user_title || selectedSupport.login_id || '알 수 없는 사용자'}</dd>
              <dt className="font-semibold text-text-secondary">접수일</dt>
              <dd>{new Date(selectedSupport.created_at).toLocaleString('ko-KR')}</dd>
            </dl>
            <div className="mt-5">
              <h3 className="text-sm font-bold">내용</h3>
              <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-4 text-sm leading-6">{selectedSupport.message}</p>
            </div>
            {selectedSupport.attachments?.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-bold">첨부 사진 <span className="font-normal text-text-secondary">{selectedSupport.attachments.length}장</span></h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {selectedSupport.attachments.map((attachment) => (
                    <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-background">
                      <img src={attachment.url} alt={attachment.original_name} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                      <span className="block truncate px-2 py-2 text-xs text-text-secondary">{attachment.original_name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <button type="button" onClick={() => setSelectedSupport(null)} className="mt-6 h-11 w-full rounded-xl bg-primary font-bold text-white">확인</button>
          </section>
        </div>
      )}
      {showChildBanner && showChildInfoModal && (
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
