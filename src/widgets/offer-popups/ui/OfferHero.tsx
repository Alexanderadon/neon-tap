import { useState, type ReactNode } from 'react';

interface Props {
  /** `public/offers/<name>.webp` — the real illustration when it exists. */
  name: string;
  /** The procedural placeholder drawn until (and under) the image. */
  placeholder: ReactNode;
}

/**
 * The 335 × 180 hero slot (r 24) at the top of an offer popup. The placeholder is always drawn;
 * the image lies over it once loaded and simply never appears when the file is missing (a 404
 * or an HTML fallback both fail to decode, so `onError` hides it).
 */
export function OfferHero({ name, placeholder }: Props) {
  const [image, setImage] = useState<'loading' | 'ok' | 'missing'>('loading');
  return (
    <div className="offer-hero" aria-hidden="true">
      {placeholder}
      {image !== 'missing' && (
        <img
          className={image === 'ok' ? 'offer-hero-img offer-hero-img-on' : 'offer-hero-img'}
          src={`${import.meta.env.BASE_URL}offers/${name}.webp`}
          alt=""
          decoding="async"
          onLoad={() => setImage('ok')}
          onError={() => setImage('missing')}
        />
      )}
    </div>
  );
}
