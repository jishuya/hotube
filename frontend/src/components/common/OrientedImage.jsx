import { useEffect, useRef, useState } from 'react';
import { fitRotatedMedia } from '../../utils/mediaRotation';

export default function OrientedImage({ src, alt, rotation = 0, onLoad, imageRef, ...props }) {
  const frameRef = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [bounds, setBounds] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const frame = frameRef.current;
    const observer = new ResizeObserver(() => setBounds({ width: frame.clientWidth, height: frame.clientHeight }));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const fitted = fitRotatedMedia(size.width, size.height, bounds.width, bounds.height, rotation);
  return (
    <div ref={frameRef} className="relative h-full w-full overflow-hidden">
      <img {...props} ref={imageRef} src={src} alt={alt} draggable="false" decoding="async"
        onLoad={(event) => {
          setSize({ width: event.currentTarget.naturalWidth || 1, height: event.currentTarget.naturalHeight || 1 });
          onLoad?.(event);
        }}
        className="absolute left-1/2 top-1/2 select-none object-contain"
        style={{ width: fitted.width, height: fitted.height, maxWidth: 'none', transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
    </div>
  );
}
