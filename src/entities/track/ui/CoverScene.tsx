import { useEffect, useRef, useState } from 'react';
import type { Genre } from '@/shared/types/chart';
import { coverImage, coverSpec } from '../model/cover';
import { drawCover } from '../lib/drawCover';
import './cover-scene.css';

/** The offscreen cover is this many pixels wide; upscaling it to the screen is the blur. */
export const SCENE_PX = 24;
/** Cross-fade between two tracks, ms (spec §2.13: .3 s). */
const SETTLE_MS = 250;

interface Props {
  /** Focused track — `undefined` shows only the veil over the page background. */
  id?: string;
  genre?: Genre;
  /** `absolute` (default) fills a positioned parent; `fixed` covers the viewport. */
  position?: 'absolute' | 'fixed';
  className?: string;
}

/**
 * The scene: the focused track's procedural cover, pre-rendered on a 24 × 24 canvas and stretched
 * 25 % past the screen at 35 % opacity, under the veil gradient. Changing `id` cross-fades to the
 * new cover. No CSS filters anywhere (spec §4.4).
 */
export function CoverScene({ id, genre, position = 'absolute', className }: Props) {
  // One layer, settled: the id is taken 250 ms after it stops changing, so a flick across several
  // cards paints one cover, not one per card (each full-screen canvas costs a phone a frame).
  const [shown, setShown] = useState<{ id: string; genre?: Genre }>(() => ({ id: id ?? '', genre }));
  useEffect(() => {
    const t = setTimeout(() => setShown((prev) => (prev.id === (id ?? '') && prev.genre === genre ? prev : { id: id ?? '', genre })), SETTLE_MS);
    return () => clearTimeout(t);
  }, [id, genre]);
  const cls = ['scene', position === 'fixed' && 'scene-fixed', className].filter(Boolean).join(' ');
  return (
    <div className={cls} aria-hidden="true">
      {shown.id && <SceneCanvas id={shown.id} genre={shown.genre} />}
      <div className="scene-veil" />
    </div>
  );
}

function SceneCanvas({ id, genre }: { id: string; genre?: Genre }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const picture = coverImage(id);
    if (!picture) {
      drawCover(ctx, coverSpec(id, genre), SCENE_PX);
      return;
    }
    // A picture cover: the picture squeezed into the 24 × 24 canvas is the colour wash.
    let live = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (live) ctx.drawImage(img, 0, 0, SCENE_PX, SCENE_PX);
    };
    img.src = picture;
    return () => {
      live = false;
    };
  }, [id, genre]);
  return <canvas ref={ref} className="scene-cover" width={SCENE_PX} height={SCENE_PX} data-track={id} />;
}
