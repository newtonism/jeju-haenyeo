import React, { useState } from 'react';
import { Waves } from 'lucide-react';

interface EditorialImageProps {
  src: string;
  alt: string;
  caption?: string;
  aspectClass?: string;
  className?: string;
}

export const EditorialImage: React.FC<EditorialImageProps> = ({
  src,
  alt,
  caption,
  aspectClass = 'aspect-[4/3]',
  className = '',
}) => {
  const [failed, setFailed] = useState(false);

  return (
    <figure className={`flex flex-col ${className}`}>
      <div
        className={`relative w-full overflow-hidden rounded-lg bg-slate-200/70 border border-slate-200/90 ${aspectClass}`}
      >
        {!failed ? (
          <img
            src={src}
            alt={alt}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-100 via-slate-200/80 to-sky-100/60 p-6 text-center">
            <Waves className="w-7 h-7 text-[#0E5A6F]" aria-hidden="true" />
            <span className="text-sm font-medium text-slate-700 max-w-xs">{alt}</span>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-xs text-slate-500 leading-relaxed">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};
