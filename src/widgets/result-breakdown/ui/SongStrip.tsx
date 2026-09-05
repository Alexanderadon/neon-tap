import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { dict } from '@/shared/i18n';
import type { Section } from '@/entities/chart';
import { formatClock, type ResultTimeline } from '@/entities/score';
import { drawStrip } from '../lib/drawStrip';

interface Props {
  timeline: ResultTimeline;
  sections: readonly Section[];
  duration: number;
}

/** Full-song strip of judgement ticks with lane-section bands; hover / touch shows the song time. */
export function SongStrip({ timeline, sections, duration }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawStrip(ctx, 0, 0, w, h, { timeline, sections, duration }, 10);
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [timeline, sections, duration]);

  const onPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    setCursor(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <div className="result-strip" aria-label={dict.resultWhereMissed}>
      <canvas
        ref={ref}
        className="result-strip-canvas"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => {
          // A tap should leave its time label on screen; only a departing mouse clears it.
          if (e.pointerType === 'mouse') setCursor(null);
        }}
      />
      {cursor !== null && (
        <>
          <div className="result-strip-cursor" style={{ left: `${cursor * 100}%` }} />
          <div className="result-strip-time" style={{ left: `${cursor * 100}%` }}>
            {formatClock(cursor * duration)}
          </div>
        </>
      )}
      <div className="result-strip-axis">
        <span>{formatClock(0)}</span>
        <span className="result-strip-hint">{dict.resultStripHint}</span>
        <span>{formatClock(duration)}</span>
      </div>
    </div>
  );
}
