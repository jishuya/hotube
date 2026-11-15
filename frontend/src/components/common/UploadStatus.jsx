import { useEffect, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { bindUploadRecovery, uploadManager } from '../../services/uploadManager';

export default function UploadStatus() {
  const { user } = useAuth();
  const state = useSyncExternalStore(uploadManager.subscribe, uploadManager.getSnapshot);
  useEffect(() => {
    uploadManager.setUser(user?.id || null);
    if (user?.id) void uploadManager.resume();
    return bindUploadRecovery(uploadManager, window, document);
  }, [user?.id]);

  if (!user?.id || state.userId !== user.id || (!state.running && !state.pending && !state.total && !state.error)) return null;
  const bytes = state.completedBytes + (state.transfer?.loaded || 0);
  const percent = state.totalBytes ? Math.min(100, Math.floor(bytes / state.totalBytes * 100)) : 0;
  const label = state.running
    ? state.transfer?.phase === 'saving' ? '파일을 임시 저장하고 있어요' : `업로드 중 · ${percent}%`
    : state.pending ? state.paused ? '업로드를 중지했어요' : '업로드가 중단됐어요. 다시 시도할 수 있어요'
      : state.error ? '업로드 결과를 확인해 주세요' : '업로드가 완료됐어요';
  return (
    <aside aria-label="파일 업로드 상태" className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-lg rounded-xl border border-border bg-surface p-3 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <Link to="/upload" className="min-w-0 flex-1 text-sm font-semibold">
          <span role="status">{label}</span>
          <span className="mt-1 block text-xs text-text-secondary">{state.completed}개 완료 · {state.pending}개 남음</span>
        </Link>
        {state.running
          ? <button type="button" onClick={() => uploadManager.pause()} className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm">중지</button>
          : state.pending ? <button type="button" onClick={() => void uploadManager.resume({ manual: true })} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm text-white">이어서 올리기</button>
            : <button type="button" onClick={() => uploadManager.dismiss()} className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm">닫기</button>}
      </div>
      {state.notice && <p className="mt-2 text-xs text-text-secondary">{state.notice}</p>}
      {state.error && !state.running && <p className="mt-2 text-xs text-error">{state.error}</p>}
    </aside>
  );
}
