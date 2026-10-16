import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ring } from 'ldrs/react';
import 'ldrs/react/Ring.css';

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
      className="m-auto w-11/12 max-w-sm rounded-3xl border border-primary/10 bg-surface p-8 text-center text-text-primary shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
        <div className="motion-reduce:hidden"><Ring size={56} stroke={4} speed={1.8} color="currentColor" /></div>
        <div className="hidden size-14 rounded-full border-4 border-primary/20 border-t-primary motion-reduce:block" />
      </div>
      <h2 id="upload-progress-title" role="status" className="text-lg font-bold">{title}</h2>
      <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined} className="mt-3 text-2xl font-bold tabular-nums text-primary">
        {progress === null ? <span aria-hidden="true">…</span> : `${progress}%`}
      </div>
      <button type="button" onClick={onStop} className="mt-6 min-h-11 rounded-full border border-border px-5 text-sm text-text-secondary transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{stopLabel}</button>
    </dialog>,
    document.body,
  );
}
