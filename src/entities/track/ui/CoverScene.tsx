import { useEffect, useRef, useState } from 'react';
import type { Genre } from '@/shared/types/chart';
import { coverSpec } from '../model/cover';
import { drawCover } from '../lib/drawCover';
import './cover-scene.css';

/** The offscreen cover is this many pixels wide; upscaling it to the screen is the blur. */
export const SCENE_PX = 24;
/** Cross-fade between two tracks, ms (spec §2.13: .3 s). */
const FADE_MS = 300;

interface Props {
  /** Focused track — `undefined` shows only the veil over the page background. */
  id?: string;
  genre?: Genre;
  /** `absolute` (default) fills a positioned parent; `fixed` covers the viewport. */
  position?: 'absolute' | 'fixed';
  className?: string;
}

interface Layer {
  key: number;
  id: string;
  genre?: Genre;
}

/**
 * The scene: the focused track's procedural cover, pre-rendered on a 24 × 24 canvas and stretched
 * 25 % past the screen at 35 % opacity, under the veil gradient. Changing `id` cross-fades to the
 * new cover. No CSS filters anywhere (spec §4.4).
 */
export function CoverScene({ id, genre, position = 'absolute', className }: Props) {
  const [layers, setLayers] = useState<Layer[]>(() => (id ? [{ key: 0, id, genre }] : []));
  const seq = useRef(0);
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      const nextId = id ?? '';
      if (top ? top.id === nextId && top.genre === genre : !nextId) return prev;
      // Keep the current layer under the new one for the cross-fade; an empty id is a layer that draws nothing.
      return [...prev.slice(-1), { key: ++seq.current, id: nextId, genre }];
    });
  }, [id, genre]);
  useEffect(() => {
    if (layers.length < 2) return;
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), FADE_MS);
    return () => clearTimeout(t);
  }, [layers]);
  const cls = ['scene', position === 'fixed' && 'scene-fixed', className].filter(Boolean).join(' ');
  return (
    <div className={cls} aria-hidden="true">
      {layers.map((l, i) => l.id && <SceneCanvas key={l.key} id={l.id} genre={l.genre} fading={i < layers.length - 1} />)}
      <div className="scene-veil" />
    </div>
  );
}

function SceneCanvas({ id, genre, fading }: { id: string; genre?: Genre; fading: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCover(ctx, coverSpec(id, genre), SCENE_PX);
  }, [id, genre]);
  return <canvas ref={ref} className={fading ? 'scene-cover scene-cover-out' : 'scene-cover'} width={SCENE_PX} height={SCENE_PX} data-track={id} />;
}
