import { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

export default function MediaDescription({ text, label = '영상 설명', onEdit }) {
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;
    let active = true;
    const measure = () => {
      if (!active) return;
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
      setOverflows(element.scrollHeight > lineHeight * 3 + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    document.fonts?.ready.then(measure);
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', measure);
    return () => {
      active = false;
      observer.disconnect();
      fonts?.removeEventListener('loadingdone', measure);
    };
  }, [text, expanded]);

  if (!text) return null;
  return (
    <div className="relative pr-7">
      <div
        ref={textRef}
        role={onEdit ? 'button' : undefined}
        tabIndex={onEdit ? 0 : undefined}
        aria-label={onEdit ? `${label} 수정` : undefined}
        onClick={onEdit}
        onKeyDown={onEdit ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onEdit();
          }
        } : undefined}
        className={`whitespace-pre-wrap break-words font-caption text-left text-base font-normal leading-5 text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${onEdit ? 'cursor-pointer' : ''} ${expanded ? 'block' : 'line-clamp-3'}`}
      >{text}</div>
      {overflows && (
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
          aria-label={`${label} ${expanded ? '접기' : '펼치기'}`} title={expanded ? '접기' : '펼치기'}
          className="absolute right-0 top-10 flex size-5 items-center justify-center rounded-full text-text-secondary hover:bg-primary/10 hover:text-primary">
          <Icon icon={expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="text-xl" />
        </button>
      )}
    </div>
  );
}
