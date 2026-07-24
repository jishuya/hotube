import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getSupportRequest,
  getSupportRequests,
  updateSupportRequestStatus,
} from '../../services/supportApi';

const statusOptions = [
  { value: 'all', label: '전체' },
  { value: 'received', label: '접수됨' },
  { value: 'in_progress', label: '확인 중' },
  { value: 'resolved', label: '해결됨' },
];

const statusStyle = {
  received: 'bg-error/10 text-error',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
};

const statusLabel = {
  received: '접수됨',
  in_progress: '확인 중',
  resolved: '해결됨',
};

const SupportManagement = ({ onBack }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setRequests(await getSupportRequests(user.id));
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => requests.reduce((result, request) => ({
    ...result,
    [request.status]: (result[request.status] || 0) + 1,
  }), {}), [requests]);

  const filteredRequests = filter === 'all'
    ? requests
    : requests.filter((request) => request.status === filter);

  const openDetail = async (request) => {
    setDetailLoading(true);
    setError('');
    try {
      const detail = await getSupportRequest(request.id, user.id);
      setSelected(detail);
      if (detail.status === 'received') {
        const updated = await updateSupportRequestStatus(detail.id, 'in_progress', user.id);
        setSelected((current) => ({ ...current, status: updated.status }));
        setRequests((current) => current.map((item) => (
          item.id === detail.id ? { ...item, status: updated.status } : item
        )));
        window.dispatchEvent(new Event('support-status-changed'));
      }
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (status) => {
    if (!selected || savingStatus || selected.status === status) return;
    setSavingStatus(true);
    try {
      const updated = await updateSupportRequestStatus(selected.id, status, user.id);
      setSelected((current) => ({ ...current, status: updated.status }));
      setRequests((current) => current.map((item) => (
        item.id === selected.id ? { ...item, status: updated.status } : item
      )));
      window.dispatchEvent(new Event('support-status-changed'));
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-primary/10 hover:text-primary" aria-label="마이페이지로 돌아가기" title="뒤로가기">
              <Icon icon="mdi:arrow-left" className="text-2xl" />
            </button>
          )}
          <h1 className="truncate text-2xl font-bold">고객센터</h1>
        </div>
        <button type="button" onClick={loadRequests} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition hover:bg-primary/5 hover:text-primary" aria-label="새로고침" title="새로고침">
          <Icon icon="mdi:refresh" className={loading ? 'animate-spin text-lg' : 'text-lg'} />
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {statusOptions.map((option) => {
          const count = option.value === 'all' ? requests.length : (counts[option.value] || 0);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${filter === option.value ? 'bg-primary text-white' : 'bg-surface text-text-secondary hover:bg-primary/10'}`}
            >
              {option.label} {count}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>}

      <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-text-secondary">
            <Icon icon="mdi:loading" className="animate-spin text-2xl text-primary" />
            불러오는 중...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-20 text-center text-text-secondary">
            <Icon icon="mdi:inbox-check-outline" className="mx-auto mb-2 text-5xl text-primary/40" />
            해당 상태의 접수 내역이 없어요.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRequests.map((request) => (
              <button key={request.id} type="button" onClick={() => openDetail(request)} className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-primary/5 sm:px-5">
                <span className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${request.request_type === 'bug' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                  <Icon icon={request.request_type === 'bug' ? 'mdi:bug-outline' : 'mdi:message-question-outline'} className="text-xl" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{request.request_type === 'bug' ? '오류 리포트' : '문의사항'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusStyle[request.status]}`}>{statusLabel[request.status]}</span>
                    {request.attachment_count > 0 && <span className="flex items-center gap-0.5 text-xs text-text-secondary"><Icon icon="mdi:paperclip" />{request.attachment_count}</span>}
                  </span>
                  <span className="mt-1 block truncate text-sm text-text-primary">{request.message}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-text-secondary">
                    <span>{request.user_name || request.user_title || request.login_id || '알 수 없는 사용자'}</span>
                    <span>{new Date(request.created_at).toLocaleString('ko-KR')}</span>
                  </span>
                </span>
                <Icon icon="mdi:chevron-right" className="mt-2 shrink-0 text-xl text-text-secondary" />
              </button>
            ))}
          </div>
        )}
      </div>

      {(detailLoading || selected) && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => !detailLoading && setSelected(null)} aria-label="상세 내용 닫기" />
          {detailLoading ? (
            <div className="relative flex items-center gap-2 rounded-2xl bg-surface px-5 py-4 font-bold shadow-xl">
              <Icon icon="mdi:loading" className="animate-spin text-2xl text-primary" />
              불러오는 중...
            </div>
          ) : (
            <section className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="admin-support-detail-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selected.request_type === 'bug' ? 'bg-error/10 text-error' : 'bg-primary/15 text-primary'}`}>
                      {selected.request_type === 'bug' ? '오류 리포트' : '문의사항'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[selected.status]}`}>{statusLabel[selected.status]}</span>
                  </div>
                  <h2 id="admin-support-detail-title" className="mt-2 text-xl font-bold">접수 상세</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-primary/10" aria-label="상세 내용 닫기"><Icon icon="mdi:close" className="text-xl" /></button>
              </div>

              <dl className="mt-4 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 rounded-xl bg-background p-4 text-sm">
                <dt className="font-semibold text-text-secondary">작성자</dt>
                <dd className="font-bold">{selected.user_name || selected.user_title || selected.login_id || '알 수 없는 사용자'}</dd>
                <dt className="font-semibold text-text-secondary">접수일</dt>
                <dd>{new Date(selected.created_at).toLocaleString('ko-KR')}</dd>
              </dl>

              <div className="mt-5">
                <h3 className="text-sm font-bold">내용</h3>
                <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-4 text-sm leading-6">{selected.message}</p>
              </div>

              {selected.attachments?.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-bold">첨부 사진 <span className="font-normal text-text-secondary">{selected.attachments.length}장</span></h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selected.attachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border bg-background">
                        <img src={attachment.url} alt={attachment.original_name} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                        <span className="block truncate px-2 py-2 text-xs text-text-secondary">{attachment.original_name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="mb-2 text-sm font-bold">처리 상태</h3>
                <div className="grid grid-cols-3 gap-2">
                  {statusOptions.slice(1).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={savingStatus}
                      onClick={() => changeStatus(option.value)}
                      className={`h-10 rounded-xl text-sm font-bold transition disabled:opacity-50 ${selected.status === option.value ? 'bg-primary text-white' : 'border border-border bg-background text-text-secondary hover:border-primary hover:text-primary'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="mt-4 h-11 w-full rounded-xl bg-primary font-bold text-white">확인</button>
            </section>
          )}
        </div>
      )}
    </section>
  );
};

export default SupportManagement;
