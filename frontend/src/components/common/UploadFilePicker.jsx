import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import VideoDurationBadge from './VideoDurationBadge';
import Modal from './Modal';

// Only load visible previews; large selections must not decode every original at once.
const FilePreview = ({ file }) => {
  const containerRef = useRef(null);
  const [duration, setDuration] = useState(null);
  useEffect(() => {
    const container = containerRef.current;
    let url;
    let media;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        if (media) {
          media.onloadedmetadata = null;
          media.removeAttribute('src');
          if (file.type.startsWith('video/')) media.load();
          media.remove();
          URL.revokeObjectURL(url);
          media = null;
        }
        return;
      }
      if (media) return;
      url = URL.createObjectURL(file);
      media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
      media.className = 'absolute inset-0 h-full w-full object-cover';
      if (file.type.startsWith('video/')) {
        media.muted = true;
        media.playsInline = true;
        media.preload = 'metadata';
        media.onloadedmetadata = () => {
          if (Number.isFinite(media.duration) && media.duration > 0) {
            setDuration({ file, seconds: media.duration });
          }
        };
      } else {
        media.alt = '';
      }
      media.src = url;
      container.appendChild(media);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (media) {
        media.onloadedmetadata = null;
        media.removeAttribute('src');
        if (file.type.startsWith('video/')) media.load();
        media.remove();
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);
  return <>
    <span ref={containerRef} className="absolute inset-0" aria-hidden="true" />
    {file.type.startsWith('video/') && <VideoDurationBadge media={{ durationSeconds: duration && duration.file === file ? duration.seconds : null }} fallbackText="영상" />}
  </>;
};

const UploadFilePicker = ({ files, limit, duplicateNotices = [], onCancel, onConfirm }) => {
  const [dialogNode, setDialogNode] = useState(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [selected, setSelected] = useState(() => files.slice(0, limit).map((_, index) => index));
  useEffect(() => {
    if (!dialogNode) return;
    const dialog = dialogNode;
    const unlock = lockBodyScroll();
    dialog.showModal();
    return () => { dialog.close(); unlock(); };
  }, [dialogNode]);

  const full = selected.length >= limit;
  return createPortal(
    <dialog ref={setDialogNode} onCancel={(event) => { event.preventDefault(); if (duplicateNotices.length && !noticeDismissed) setNoticeDismissed(true); else onCancel(); }}
      aria-labelledby="upload-picker-title" aria-describedby="upload-picker-description"
      className="m-auto h-[100dvh] max-h-[100dvh] w-screen max-w-2xl border-0 bg-surface p-0 text-text-primary backdrop:bg-black/60 sm:h-[90dvh] sm:rounded-2xl">
      <div className="flex h-full min-h-0 flex-col">
        <header className="relative shrink-0 border-b border-border p-4">
          <div className="flex min-h-8 items-center justify-between gap-3 pr-9">
            <h2 id="upload-picker-title" className="text-lg font-extrabold">첨부파일 선택</h2>
            <button type="button" onClick={onCancel} aria-label="선택 화면 닫기" className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-lg text-text-secondary hover:bg-gray-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-6" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <p id="upload-picker-description" className="mt-2 text-sm text-text-secondary">
            가져온 {files.length}개중 {limit}개를 골라주세요. 날짜가 오래된 순으로 표시됩니다. 다른 파일을 고르려면 선택을 해제해 주세요.
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {files.map((file, index) => {
              const order = selected.indexOf(index);
              const chosen = order !== -1;
              return (
                <button key={index} type="button" aria-pressed={chosen}
                  aria-label={`${file.name}${chosen ? `, ${order + 1}번째 선택` : ''}`}
                  disabled={full && !chosen}
                  onClick={() => setSelected((current) => current.includes(index)
                    ? current.filter((value) => value !== index)
                    : current.length < limit ? [...current, index] : current)}
                  className={`min-w-0 overflow-hidden rounded-xl border-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 ${chosen ? 'border-primary bg-primary/10' : 'border-transparent bg-gray-100'}`}>
                  <span className="relative block aspect-square overflow-hidden bg-gray-200">
                    <FilePreview file={file} />
                    <span className={`absolute right-1 top-1 flex size-7 items-center justify-center rounded-full border-2 text-sm font-extrabold shadow ${chosen ? 'border-primary bg-primary text-white' : 'border-white bg-black/30'}`}>
                      {chosen ? order + 1 : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <footer className="shrink-0 border-t border-border bg-surface p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" disabled={!selected.length} onClick={() => onConfirm(selected.map((index) => files[index]))}
            className="w-full rounded-xl bg-primary px-4 py-3 font-extrabold text-white disabled:opacity-40">
            선택한 {selected.length}개 첨부하기
          </button>
        </footer>
      </div>
      {dialogNode && <Modal
        isOpen={duplicateNotices.length > 0 && !noticeDismissed}
        onClose={() => setNoticeDismissed(true)}
        title="중복 파일 제외"
        message={duplicateNotices.join('\n')}
        confirmText="확인"
        portalTarget={dialogNode}
      />}
    </dialog>, document.body,
  );
};

export default UploadFilePicker;
