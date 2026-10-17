import { useEffect, useRef, useState } from 'react';
import { fitRotatedMedia } from '../../utils/mediaRotation';

export default function OrientedImage({ src, alt, rotation = 0, onLoad, imageRef, fit = 'contain', naturalAspect = false, as = 'img', ...props }) {
  const frameRef = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [bounds, setBounds] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const frame = frameRef.current;
    const observer = new ResizeObserver(() => setBounds({ width: frame.clientWidth, height: frame.clientHeight }));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const fitted = fitRotatedMedia(size.width, size.height, bounds.width, bounds.height, rotation, fit);
  const Element = as;
  const handleLoad = (event) => {
    const media = event.currentTarget;
    setSize({ width: media.naturalWidth || media.videoWidth || 1, height: media.naturalHeight || media.videoHeight || 1 });
    onLoad?.(event);
  };
  const aspectRatio = rotation % 180 ? size.height / size.width : size.width / size.height;
  return (
    <div ref={frameRef} className={`relative w-full overflow-hidden ${naturalAspect ? '' : 'h-full'}`} style={naturalAspect ? { aspectRatio } : undefined}>
      <Element {...props} ref={imageRef} src={src} alt={alt} draggable="false" {...(as === 'img' ? { decoding: 'async', onLoad: handleLoad } : { onLoadedMetadata: handleLoad })}
        className="absolute left-1/2 top-1/2 select-none object-contain"
        style={{ width: fitted.width, height: fitted.height, maxWidth: 'none', transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
    </div>
  );
}
