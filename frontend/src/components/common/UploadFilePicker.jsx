import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../utils/bodyScrollLock';

// Only load visible previews; large selections must not decode every original at once.
const FilePreview = ({ file }) => {
  const containerRef = useRef(null);
  useEffect(() => {
    const container = containerRef.current;
    let url;
    let media;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        if (media) {
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
        media.removeAttribute('src');
        if (file.type.startsWith('video/')) media.load();
        media.remove();
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);
  return <span ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
};

const UploadFilePicker = ({ files, limit, existingCount, onCancel, onConfirm }) => {
  const dialogRef = useRef(null);
  const [selected, setSelected] = useState([]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const unlock = lockBodyScroll();
    dialog.showModal();
    return () => { dialog.close(); unlock(); };
  }, []);

  const full = selected.length >= limit;
  return createPortal(
    <dialog ref={dialogRef} onCancel={(event) => { event.preventDefault(); onCancel(); }}
      aria-labelledby="upload-picker-title" aria-describedby="upload-picker-description"
      className="m-auto h-[100dvh] max-h-[100dvh] w-screen max-w-2xl border-0 bg-surface p-0 text-text-primary backdrop:bg-black/60 sm:h-[90dvh] sm:rounded-2xl">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="upload-picker-title" className="text-lg font-extrabold">이번에 올릴 사진·영상 선택</h2>
            <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-bold">취소</button>
          </div>
          <p id="upload-picker-description" className="mt-2 text-sm text-text-secondary">
            가져온 {files.length}개 중 최대 {limit}개를 골라주세요.
            {existingCount > 0 && ` 이미 첨부한 파일은 ${existingCount}개예요.`}
          </p>
          <p className="mt-2 font-extrabold text-primary" role="status">
            {selected.length}/{limit}개 선택{full ? ' · 다른 파일을 고르려면 선택을 해제해 주세요' : ''}
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
                    {file.type.startsWith('video/') && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">영상</span>}
                  </span>
                  <span className="block truncate px-1 py-1.5 text-xs">{file.name}</span>
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
    </dialog>, document.body,
  );
};

export default UploadFilePicker;
