import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  getVapidPublicKey,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from '../../services/pushApi';

const urlBase64ToUint8Array = (value) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
};

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

const isAppleMobile = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const PushNotificationSettings = ({ userId }) => {
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

  useEffect(() => {
    let active = true;
    if (!supported) {
      setBusy(false);
      return undefined;
    }
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((current) => {
        if (active) setSubscription(current);
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
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        throw new Error('알림 권한이 허용되지 않았습니다. 기기 설정에서 HoTube 알림을 허용해주세요.');
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const { publicKey } = await getVapidPublicKey();
      const nextSubscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await savePushSubscription(userId, nextSubscription.toJSON());
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
      if (current) {
        await removePushSubscription(userId, current.endpoint);
        await current.unsubscribe();
      }
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
      const result = await sendTestPush(userId);
      if (!result.sent) throw new Error('등록된 기기로 알림을 보내지 못했습니다.');
      setMessage('테스트 알림을 보냈습니다. 잠시 후 기기 알림을 확인해주세요.');
    } catch (testError) {
      setError(testError.message || '테스트 알림을 보내지 못했습니다');
    } finally {
      setBusy(false);
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
        <button type="button" disabled={busy} onClick={testNotification} className="mt-3 ml-[52px] text-xs font-bold text-primary disabled:opacity-50">
          테스트 알림 보내기
        </button>
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
