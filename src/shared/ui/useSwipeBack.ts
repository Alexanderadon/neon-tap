import { useEffect } from 'react';
import { isBackSwipe } from '@/shared/lib/input/gestures';

/**
 * Phone "back" gesture for secondary screens and sheets: a swipe from the left edge to the right
 * calls `onBack`. Listens on the document while `active`, so it works whatever element is under
 * the finger; the game field never mounts this hook.
 */
export function useSwipeBack(onBack: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;
    let start: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!start || start.id !== e.pointerId) return;
      const from = start;
      start = null;
      if (isBackSwipe(from, { x: e.clientX, y: e.clientY })) onBack();
    };
    const cancel = () => {
      start = null;
    };
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    document.addEventListener('pointercancel', cancel, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
    };
  }, [onBack, active]);
}
