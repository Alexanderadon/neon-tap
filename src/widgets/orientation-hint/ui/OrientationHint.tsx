import { useEffect, useState } from 'react';
import { dict } from '@/shared/i18n';
import { needsRotateHint } from '@/shared/lib/viewport';
import { Headline, Icon, Line, ObjButton } from '@/shared/ui';
import './orientation-hint.css';

const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function check(): boolean {
  return needsRotateHint(isTouchDevice(), window.innerWidth, window.innerHeight);
}

/**
 * «Поверни телефон» (screens-onboard C9): a veil over the paused game, the 335 column centred —
 * a 56 × 96 phone in the dark face turning 90° and back, the headline in the verdict material,
 * «игра идёт в портрете» and «Всё равно продолжить». Shown on a touch device in landscape with a
 * viewport shorter than 500 px; hidden on desktop and tablets, re-evaluated on resize /
 * orientation change (the flag comes from the pure `needsRotateHint`).
 */
export function OrientationHint() {
  const [show, setShow] = useState(check);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => setShow(check());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // Portrait again → the next landscape shows the hint again.
  useEffect(() => {
    if (!show) setDismissed(false);
  }, [show]);

  if (!show || dismissed) return null;
  return (
    <div className="rotate" role="dialog" aria-modal="true" aria-label={dict.rotateTitle}>
      <div className="rotate-col">
        <span className="rotate-phone" aria-hidden="true">
          <i />
        </span>
        <Headline className="rotate-head">{dict.rotateTitle}</Headline>
        <Line className="rotate-line">{dict.rotateShort}</Line>
        <ObjButton className="rotate-btn" icon={<Icon name="arrow" />} label={dict.rotateAnyway} onClick={() => setDismissed(true)} />
      </div>
    </div>
  );
}
