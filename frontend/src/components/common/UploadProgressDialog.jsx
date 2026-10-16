import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
      className="relative m-auto w-11/12 max-w-sm overflow-hidden rounded-3xl border border-primary/15 bg-surface p-8 text-center text-text-primary shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-md"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-primary/15 to-transparent" />
      <div className="relative">
      <h2 id="upload-progress-title" role="status" className="text-lg font-bold">{title}</h2>
      <p className="my-6 text-5xl font-bold tracking-tight tabular-nums text-primary">
        {progress === null ? <span aria-hidden="true">…</span> : <>{progress}<span className="ml-1 text-xl font-medium text-primary/60">%</span></>}
      </p>
      <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined} className="h-2.5 overflow-hidden rounded-full bg-primary/10 ring-1 ring-inset ring-primary/5">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-primary/65 to-primary shadow-[0_0_12px_rgb(var(--color-primary)/0.3)] transition-[width] duration-300 ease-out motion-reduce:transition-none ${progress === null ? 'w-1/3 animate-pulse motion-reduce:animate-none' : ''}`}
          style={progress === null ? undefined : { width: `${progress}%` }}
        />
      </div>
      <button type="button" onClick={onStop} className="mt-7 min-h-11 rounded-full bg-background px-7 text-sm font-medium text-text-secondary transition hover:bg-primary/10 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{stopLabel}</button>
      </div>
    </dialog>,
    document.body,
  );
}
