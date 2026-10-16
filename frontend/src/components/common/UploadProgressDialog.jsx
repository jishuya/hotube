import { lockBodyScroll } from '../../utils/bodyScrollLock';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

export default function UploadProgressDialog({ title, percent, onStop, stopLabel, phase = 'uploading' }) {
  const dialogRef = useRef(null);
  const progress = Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.floor(percent))) : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const unlockScroll = lockBodyScroll();
    dialog.showModal();
    return () => {
      dialog.close();
      unlockScroll();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      style={phase === 'preparing' ? { '--color-primary': '180 130 45' } : undefined}
      aria-labelledby="upload-progress-title"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => event.stopPropagation()}
      className="fixed inset-0 m-auto max-h-[76dvh] w-[calc(100vw-3rem)] max-w-[240px] overflow-y-auto rounded-2xl border border-primary/10 bg-white p-4 text-gray-900 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/5" aria-hidden="true">
          <div className="flex size-9 items-center justify-center rounded-xl border border-white bg-primary/15 text-primary shadow-sm">
            <Icon icon="lucide:cloud-upload" className="text-xl" />
          </div>
        </div>
        <h2 id="upload-progress-title" role="status" className="text-base font-semibold text-gray-900">{title}</h2>
        <div className="mt-3 w-full rounded-xl border border-primary/10 bg-primary/[0.03] px-3 py-2.5">
          {progress !== null && <p className="mb-2 text-center text-sm font-semibold tabular-nums text-primary">{progress}<span className="ml-0.5 text-xs font-medium">%</span></p>}
          <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined} className="relative h-2 overflow-hidden rounded-full bg-primary/10 shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-300 ease-out motion-reduce:transition-none ${progress === null ? 'w-1/3 animate-pulse motion-reduce:animate-none' : ''}`}
              style={progress === null ? undefined : { width: `${progress}%` }}
            />
            <span aria-hidden="true" className="upload-progress-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
        </div>
        <button type="button" onClick={onStop} className="mt-3 min-h-11 w-full rounded-lg border border-[#e2d8cb] bg-[#f2ece3] px-4 py-2.5 text-sm font-medium text-[#715b43] transition-colors hover:border-[#d3c3b0] hover:bg-[#e8ddcf] hover:text-[#59442f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{stopLabel}</button>
      </div>
    </dialog>,
    document.body,
  );
}
