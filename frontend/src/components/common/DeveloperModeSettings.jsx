import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { getDeveloperMode, saveDeveloperMode, sendManualMediaNotification } from '../../services/pushApi';

export default function DeveloperModeSettings() {
  const [enabled, setEnabled] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [groups, setGroups] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [sendError, setSendError] = useState('');
  const pendingRequest = useRef(null);
  const sendInFlight = useRef(false);

  const sendAnnouncement = async () => {
    if (sendInFlight.current || !groups.length) return;
    sendInFlight.current = true;
    setSending(true);
    setSendError('');
    setSendMessage('');
    pendingRequest.current ||= { id: crypto.randomUUID(), groups: [...groups] };
    try {
      const result = await sendManualMediaNotification(pendingRequest.current.groups, pendingRequest.current.id);
      setSendMessage(result.recipients === 0
        ? '선택한 그룹에 본인을 제외한 사용자가 없습니다.'
        : `${result.recipients}명에게 앱 알림을 등록했습니다. 푸시 발송: ${result.sent}개 기기${result.failed ? `, 실패: ${result.failed}개 기기` : ''}.`);
      pendingRequest.current = null;
    } catch (failure) {
      setSendError(`${failure.message} · 다시 누르면 같은 요청의 결과를 확인하며 중복 발송하지 않습니다.`);
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const selectGroup = (value) => {
    pendingRequest.current = null;
    setSendError('');
    setSendMessage('');
    setGroups((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  useEffect(() => {
    let active = true;
    getDeveloperMode().then((data) => {
      if (active) setEnabled(data.enabled);
    }).catch((failure) => {
      if (active) setError(failure.message);
    });
    return () => { active = false; };
  }, []);

  const toggle = async () => {
    if (busy || enabled === null) return;
    setBusy(true);
    setError('');
    try {
      const saved = await saveDeveloperMode(!enabled);
      setEnabled(saved.enabled);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`border-b border-border px-5 py-4 ${enabled ? 'bg-orange-100/60 dark:bg-orange-500/10' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon icon="mdi:code-braces" className="text-xl" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">개발자 모드 {enabled ? '켜짐' : ''}</p>
          <p className="mt-1 text-xs text-text-secondary">내 작업의 자동 알림을 끕니다.</p>
        </div>
        <button type="button" role="switch" aria-label="개발자 모드" aria-checked={enabled === true}
          disabled={busy || sending || enabled === null} onClick={toggle}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50 ${enabled ? 'bg-orange-600 text-white' : 'bg-primary/10 text-primary'}`}>
          {busy ? '저장 중' : enabled === null ? '불러오는 중' : enabled ? 'ON' : 'OFF'}
        </button>
      </div>
      {enabled && (
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-bold">새 미디어 알림 보내기</p>
          <fieldset disabled={sending || busy} className="mt-3 flex flex-wrap gap-3">
            <legend className="sr-only">알림을 받을 가족</legend>
            {[
              ['dad', '아빠가족'], ['mom', '엄마가족'], ['couple', '부부'],
            ].map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={groups.includes(value)} onChange={() => selectGroup(value)} className="rounded border-border text-primary focus:ring-primary" />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="mt-3 rounded-lg bg-primary/5 p-3 text-xs">
            <p className="font-bold">새로운 추억이 등록됐어요</p>
            <p className="mt-1">👶🏻호튜브에 새로운 사진 또는 영상이 올라왔어요</p>
          </div>
          <button type="button" disabled={sending || busy || !groups.length} onClick={sendAnnouncement}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Icon icon="mdi:bell-ring-outline" />
            {sending ? '발송 중…' : sendError ? '발송 결과 다시 확인' : '선택한 가족에게 알림 보내기'}
          </button>
          {sendMessage && <p role="status" className="mt-2 text-xs font-semibold text-primary">{sendMessage}</p>}
          {sendError && <p role="alert" className="mt-2 text-xs text-error">{sendError}</p>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
