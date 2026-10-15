import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

export default function UploadProgressDialog({ title, message, percent, sizeLabel, onStop, stopLabel }) {
  const dialogRef = useRef(null);

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
      aria-describedby="upload-progress-message"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => event.stopPropagation()}
      className="m-auto w-11/12 max-w-sm rounded-2xl border-0 bg-surface p-6 text-center text-text-primary shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <Icon icon="mdi:loading" className="mx-auto mb-4 animate-spin text-4xl text-primary" aria-hidden="true" />
      <h2 id="upload-progress-title" className="text-lg font-bold">{title}</h2>
      <p id="upload-progress-message" className="mt-2 break-words text-sm text-text-secondary">{message}</p>
      <div className="mt-5" role="status">
        <progress max={100} value={percent ?? undefined} aria-label={title} className="block h-3 w-full accent-primary" />
        {percent !== null && <p className="mt-2 text-lg font-bold tabular-nums text-primary">{percent}%</p>}
        {sizeLabel && <p className="mt-1 text-xs tabular-nums text-text-secondary">{sizeLabel}</p>}
      </div>
      <button type="button" onClick={onStop} className="mt-5 min-h-10 px-3 text-xs text-text-secondary underline">{stopLabel}</button>
    </dialog>,
    document.body,
  );
}
