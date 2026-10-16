let lockCount = 0;
let originalOverflow;

// Nested dialogs may unmount in either order during a route change.
export const lockBodyScroll = () => {
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) document.body.style.overflow = originalOverflow;
  };
};
