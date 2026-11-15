// Fullscreen permission alone does not request a landscape screen orientation.
export const bindYoutubeFullscreenOrientation = (iframe) => {
  // The thumbnail view has no iframe until playback opens, and closing removes it.
  if (!iframe) return undefined;
  const doc = iframe.ownerDocument;
  const orientation = doc.defaultView?.screen?.orientation;
  let active = false;
  let disposed = false;
  let revision = 0;

  const unlock = () => {
    try {
      orientation?.unlock?.();
    } catch {
      // Some browsers expose the API without permitting orientation changes.
    }
  };

  const onFullscreenChange = async () => {
    const fullscreenElement = doc.fullscreenElement || doc.webkitFullscreenElement;
    const nextActive = fullscreenElement === iframe;
    if (nextActive === active) return;
    active = nextActive;
    const requestRevision = ++revision;
    if (!active) {
      unlock();
      return;
    }
    try {
      await orientation?.lock?.('landscape');
      // A lock can finish after the user has already left fullscreen.
      if (disposed || (!active && requestRevision !== revision)) unlock();
    } catch {
      // Keep YouTube fullscreen usable when orientation locking is unsupported.
    }
  };

  doc.addEventListener('fullscreenchange', onFullscreenChange);
  doc.addEventListener('webkitfullscreenchange', onFullscreenChange);
  return () => {
    disposed = true;
    revision += 1;
    doc.removeEventListener('fullscreenchange', onFullscreenChange);
    doc.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    if (active) unlock();
    active = false;
  };
};
