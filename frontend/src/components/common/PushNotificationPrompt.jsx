import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import { enablePushOnCurrentDevice } from '../../services/pushApi';

const isAppleMobile = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

const PushNotificationPrompt = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dismissalKey = user?.id ? `hotube_push_prompt_dismissed:${user.id}` : '';

  useEffect(() => {
    let active = true;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!user?.id || !supported || Notification.permission === 'denied'
      || localStorage.getItem(dismissalKey) === 'true') return undefined;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active && !subscription) setVisible(true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [dismissalKey, user?.id]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(dismissalKey, 'true');
    setVisible(false);
  };

  const enable = async () => {
    if (isAppleMobile() && !isStandalone()) {
      setError('iPhone에서는 Safari 공유 버튼 → 홈 화면에 추가 후 설치된 HoTube에서 켜주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await enablePushOnCurrentDevice();
      setVisible(false);
    } catch (enableError) {
      setError(enableError.message || '알림을 켜지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl border border-primary/20 bg-surface p-4 shadow-xl" aria-label="푸시 알림 안내">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon icon="mdi:bell-ring-outline" className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">새로운 가족 소식을 알려드릴까요?</p>
          <p className="mt-1 text-sm text-text-secondary">새 추억, 댓글과 문의 처리 소식을 기기 알림으로 받아보세요.</p>
          {error && <p role="alert" className="mt-2 text-xs font-semibold text-error">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={enable} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {busy ? '연결 중...' : '알림 받기'}
            </button>
            <button type="button" disabled={busy} onClick={dismiss} className="rounded-full px-3 py-2 text-xs font-bold text-text-secondary">
              나중에
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default PushNotificationPrompt;
