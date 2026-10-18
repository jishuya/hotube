import { useEffect, useState } from 'react';

const ScrollToTopButton = ({ boundaryRef, selectionMode = false }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let boundaryPassed = false;
    let frame = 0;
    let observer;
    const updateVisibility = () => {
      const scrollY = window.scrollY;
      const shouldShow = boundaryRef ? boundaryPassed : scrollY >= window.innerHeight * 0.8;
      setVisible((current) => scrollY <= 100 ? false : current || shouldShow);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        updateVisibility();
      });
    };
    const observeBoundary = () => {
      observer?.disconnect();
      if (boundaryRef?.current) {
        const header = document.querySelector('header')?.closest('.sticky');
        const headerHeight = header?.getBoundingClientRect().height || 0;
        boundaryPassed = boundaryRef.current.getBoundingClientRect().bottom <= headerHeight;
        observer = new IntersectionObserver(([entry]) => {
          boundaryPassed = entry.boundingClientRect.bottom <= headerHeight;
          scheduleUpdate();
        }, { rootMargin: `-${headerHeight}px 0px 0px 0px` });
        observer.observe(boundaryRef.current);
      }
      scheduleUpdate();
    };
    observeBoundary();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', observeBoundary);
    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', observeBoundary);
    };
  }, [boundaryRef]);

  return (
    <button
      type="button"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={() => window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })}
      aria-label="맨 위로 이동"
      title="맨 위로"
      className={`scroll-to-top fixed right-4 z-20 flex size-[52px] items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-4 sm:right-6 ${visible ? 'scroll-to-top--visible' : ''}`}
      style={{ bottom: `calc(${selectionMode ? '11rem' : '6.5rem'} + env(safe-area-inset-bottom, 0px))` }}
    >
      <svg className="scroll-to-top__arrow" width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

export default ScrollToTopButton;
