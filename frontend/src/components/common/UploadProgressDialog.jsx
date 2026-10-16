import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

export default function UploadProgressDialog({ title, percent, onStop, stopLabel }) {
  const dialogRef = useRef(null);
  const progress = Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.floor(percent))) : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="upload-progress-title"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => event.stopPropagation()}
      className="relative m-auto max-h-[76dvh] w-[calc(100vw-3rem)] max-w-[280px] overflow-y-auto rounded-2xl border border-primary/10 bg-white p-5 text-gray-900 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:max-w-xs sm:p-6"
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/5" aria-hidden="true">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white bg-primary/15 text-primary shadow-sm">
            <Icon icon="lucide:cloud-upload" className="text-2xl" />
          </div>
        </div>
        <h2 id="upload-progress-title" role="status" className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="mt-5 w-full rounded-xl border border-primary/10 bg-primary/[0.03] px-3 py-3">
          {progress !== null && <p className="mb-2 text-right text-sm font-semibold tabular-nums text-primary">{progress}<span className="ml-0.5 text-xs font-medium">%</span></p>}
          <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined} className="h-2.5 overflow-hidden rounded-full bg-primary/10 shadow-inner">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-300 ease-out motion-reduce:transition-none ${progress === null ? 'w-1/3 animate-pulse motion-reduce:animate-none' : ''}`}
              style={progress === null ? undefined : { width: `${progress}%` }}
            />
          </div>
        </div>
        <button type="button" onClick={onStop} className="mt-5 min-h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{stopLabel}</button>
      </div>
    </dialog>,
    document.body,
  );
}
