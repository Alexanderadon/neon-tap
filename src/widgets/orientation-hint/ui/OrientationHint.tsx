import { useEffect, useState } from 'react';
import { dict } from '@/shared/i18n';
import { needsRotateHint } from '@/shared/lib/viewport';
import { Button } from '@/shared/ui';
import './orientation-hint.css';

const isTouchDevice = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function check(): boolean {
  return needsRotateHint(isTouchDevice(), window.innerWidth, window.innerHeight);
}

/**
 * "Rotate your phone" overlay: touch device, landscape, viewport shorter than 500 px. Hidden on
 * desktop and tablets. Re-evaluated on resize / orientation change (the flag comes from the pure
 * `needsRotateHint`). The game itself pauses on the same condition (game-canvas), so nothing is
 * lost while the overlay is up. A dismiss button exists for phones with keyboards / split screens.
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
    <div className="rotate-hint" role="dialog" aria-modal="true">
      <div className="rotate-hint-phone" aria-hidden="true">
        <span />
      </div>
      <div className="rotate-hint-title">{dict.rotateTitle}</div>
      <div className="rotate-hint-text">{dict.rotateHint}</div>
      <Button variant="ghost" onClick={() => setDismissed(true)}>
        {dict.rotateAnyway}
      </Button>
    </div>
  );
}
