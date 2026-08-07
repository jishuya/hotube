import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  enablePushOnCurrentDevice,
  disablePushOnCurrentDevice,
  getPushStatus,
  saveNotificationPreferences,
  sendTestPush,
} from '../../services/pushApi';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

const isAppleMobile = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const PushNotificationSettings = () => {
  const supported = useMemo(
    () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
    [],
  );
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState(
    supported ? Notification.permission : 'unsupported',
  );
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState({ media: true, comments: true });
  const [preferenceBusy, setPreferenceBusy] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    if (!supported) {
      setBusy(false);
      return undefined;
    }
    Promise.all([
      navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()),
      getPushStatus(),
    ])
      .then(([current, status]) => {
        if (active) {
          setSubscription(current);
          setPreferences(status.preferences || { media: true, comments: true });
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || '알림 상태를 확인하지 못했습니다');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [supported]);

  const enableNotifications = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (isAppleMobile() && !isStandalone()) {
        throw new Error('iPhone에서는 공유 버튼 → 홈 화면에 추가 후 HoTube 앱에서 알림을 켜주세요.');
      }
      const nextSubscription = await enablePushOnCurrentDevice();
      setPermission(Notification.permission);
      setSubscription(nextSubscription);
      setMessage('이 기기에서 HoTube 알림을 받을 수 있어요.');
    } catch (enableError) {
      setError(enableError.message || '알림을 켜지 못했습니다');
    } finally {
      setBusy(false);
    }
  };

  const disableNotifications = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const current = subscription
        || await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      await disablePushOnCurrentDevice(current);
      setSubscription(null);
      setMessage('이 기기의 HoTube 알림을 껐습니다.');
    } catch (disableError) {
      setError(disableError.message || '알림을 끄지 못했습니다');
    } finally {
      setBusy(false);
    }
  };

  const testNotification = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await sendTestPush();
      if (!result.sent) throw new Error('등록된 기기로 알림을 보내지 못했습니다.');
      setMessage('테스트 알림을 보냈습니다. 잠시 후 기기 알림을 확인해주세요.');
    } catch (testError) {
      setError(testError.message || '테스트 알림을 보내지 못했습니다');
    } finally {
      setBusy(false);
    }
  };

  const togglePreference = async (key) => {
    const previous = preferences;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setPreferenceBusy(key);
    setError('');
    setMessage('');
    try {
      const saved = await saveNotificationPreferences(next);
      setPreferences(saved.preferences);
      setMessage('상세 알림 설정을 저장했습니다.');
    } catch (saveError) {
      setPreferences(previous);
      setError(saveError.message || '상세 알림 설정을 저장하지 못했습니다');
    } finally {
      setPreferenceBusy('');
    }
  };

  if (!supported) {
    return (
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <Icon icon="mdi:bell-off-outline" className="text-xl" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">푸시 알림</span>
            <span className="mt-0.5 block text-xs text-text-secondary">이 브라우저에서는 푸시 알림을 지원하지 않습니다.</span>
          </span>
        </div>
      </div>
    );
  }

  const enabled = Boolean(subscription) && permission === 'granted';

  return (
    <div className="border-b border-border px-5 py-4">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-full ${enabled ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
          <Icon icon={enabled ? 'mdi:bell-ring-outline' : 'mdi:bell-outline'} className="text-xl" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">푸시 알림</span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            {busy ? '알림 상태 확인 중...' : enabled ? '이 기기에서 알림을 받고 있어요.' : '새 추억과 댓글 소식을 받아보세요.'}
          </span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={enabled ? disableNotifications : enableNotifications}
          className={`rounded-full px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${enabled ? 'bg-text-secondary' : 'bg-primary'}`}
        >
          {enabled ? '끄기' : '켜기'}
        </button>
      </div>
      {enabled && (
        <div className="ml-[52px] mt-3">
          <button type="button" onClick={() => setDetailsOpen((current) => !current)} className="flex w-full items-center justify-between rounded-lg py-1 text-left text-xs font-bold text-primary" aria-expanded={detailsOpen}>
            <span>{detailsOpen ? '상세 설정 닫기' : '자세히 보기'}</span>
            <Icon icon={detailsOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="text-lg" />
          </button>
          {detailsOpen && (
            <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl bg-background px-3">
              {[
                ['media', 'mdi:image-multiple-outline', '새 미디어 알림', '공유된 사진과 영상이 올라오면 알려드려요.'],
                ['comments', 'mdi:comment-text-outline', '댓글 알림', '내가 올리거나 댓글에 참여한 미디어의 새 댓글을 알려드려요.'],
              ].map(([key, icon, label, description]) => (
                <div key={key} className="flex items-center gap-3 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon icon={icon} className="text-lg" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-text-secondary">{description}</span>
                  </span>
                  <button type="button" role="switch" aria-checked={preferences[key]} aria-label={label} disabled={Boolean(preferenceBusy)} onClick={() => togglePreference(key)} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${preferences[key] ? 'bg-primary' : 'bg-zinc-300'}`}>
                    <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-all ${preferences[key] ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              ))}
              <button type="button" disabled={busy} onClick={testNotification} className="flex w-full items-center gap-3 py-3 text-left text-sm font-bold text-primary disabled:opacity-50">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10"><Icon icon="mdi:bell-check-outline" className="text-lg" /></span>
                테스트 알림 보내기
              </button>
            </div>
          )}
        </div>
      )}
      {isAppleMobile() && !isStandalone() && (
        <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs leading-relaxed text-text-secondary">
          iPhone: Safari 공유 버튼에서 <strong>홈 화면에 추가</strong>한 뒤 설치된 HoTube를 열어주세요.
        </p>
      )}
      {message && <p className="mt-3 text-xs font-semibold text-success">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs font-semibold text-error">{error}</p>}
    </div>
  );
};

export default PushNotificationSettings;
