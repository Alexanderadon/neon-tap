import { useEffect, useMemo, useRef } from 'react';
import { LANE_COLORS } from '@/shared/config/constants';
import { hexToRgba, renderGlowDot, renderNoteSprite, type NoteSprite } from '@/shared/lib/render';
import type { ParsedNote, Section } from '@/entities/chart';
import { formatClock, type ResultTimeline, type TimeRange } from '@/entities/score';
import { buildReplay, replayLanesAt, REPLAY_APPROACH } from '../lib/replayData';
import { FONT_DISPLAY, JUDGEMENT_COLORS } from '../lib/palette';

interface Props {
  notes: readonly ParsedNote[];
  sections: readonly Section[];
  timeline: ResultTimeline;
  /** The slice of the song to replay (≈ 8 s). */
  range: TimeRange;
}

/** Hit flash lifetime, seconds. */
const FLASH = 0.35;
/** Pause between loops, seconds. */
const LOOP_GAP = 0.9;
const MARGIN = 10;
const TOP_Y = 14;
/** Glow colour per judgement code (see `JUDGEMENT_CODE`). */
const CODE_COLORS = [JUDGEMENT_COLORS.perfect, JUDGEMENT_COLORS.great, JUDGEMENT_COLORS.good, JUDGEMENT_COLORS.miss];
const RECEPTOR_COLORS = LANE_COLORS.map((c) => hexToRgba(c, 0.4));
const HOLD_COLORS = LANE_COLORS.map((c) => hexToRgba(c, 0.32));
const HUD_FONT = `700 16px ${FONT_DISPLAY}`;
const HUD_FONT_SMALL = `400 11px ${FONT_DISPLAY}`;

/**
 * Mini playfield that replays the best streak from the chart's notes: notes fall into the lanes,
 * hit flashes fire at the recorded judgement times, ~8 s loop, no audio. Sprites are
 * pre-rendered (no `shadowBlur` per frame), the frame touches only typed arrays, and the
 * animation stops while the tab is hidden or the canvas is scrolled out of view.
 */
export function BestMomentReplay({ notes, sections, timeline, range }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useMemo(() => buildReplay(notes, sections, timeline, range), [notes, sections, timeline, range]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let hitY = 0;
    let noteSprites: NoteSprite[][] = [];
    let glow: NoteSprite[] = [];
    const laneWidth = (lanes: number) => (w - MARGIN * 2) / lanes;

    const setup = (): boolean => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (!w || !h) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      hitY = h - 30;
      noteSprites = [];
      for (const lanes of data.laneCounts) {
        const lw = laneWidth(lanes);
        const row: NoteSprite[] = [];
        for (let lane = 0; lane < lanes; lane++) {
          row.push(renderNoteSprite(LANE_COLORS[lane % LANE_COLORS.length], lw * 0.72, Math.max(8, Math.min(14, lw * 0.28)), dpr));
        }
        noteSprites[lanes] = row;
      }
      glow = CODE_COLORS.map((c) => renderGlowDot(c, 26, dpr));
      return true;
    };

    const len = Math.max(0.1, data.range.to - data.range.from);
    let running = false;
    let visible = typeof document === 'undefined' ? true : !document.hidden;
    let onScreen = true;
    let raf = 0;
    let t0 = 0;
    let elapsed = 0;
    let lastNow = -Infinity;
    let evCursor = 0;
    let clockSec = -1;
    let clockStr = '';

    const drawHead = (k: number, cx: number, y: number, lanes: number) => {
      const lw = laneWidth(lanes);
      if (data.noteCircle[k]) {
        ctx.strokeStyle = LANE_COLORS[data.noteLane[k] % LANE_COLORS.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, y, lw * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      const s = noteSprites[lanes]?.[data.noteLane[k]];
      if (!s) return;
      ctx.drawImage(s.canvas, cx - s.width / 2, y - s.height / 2, s.width, s.height);
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const lanes = replayLanesAt(data, now);
      const lw = laneWidth(lanes);
      const fieldW = w - MARGIN * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(MARGIN, 0, fieldW, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= lanes; i++) {
        const x = Math.round(MARGIN + i * lw) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,240,255,0.6)';
      ctx.fillRect(MARGIN, hitY, fieldW, 2);
      for (let i = 0; i < lanes; i++) {
        ctx.fillStyle = RECEPTOR_COLORS[i % RECEPTOR_COLORS.length];
        ctx.fillRect(MARGIN + i * lw + lw * 0.14, hitY - 3, lw * 0.72, 8);
      }

      const fall = hitY - TOP_Y;
      for (let k = 0; k < data.noteCount; k++) {
        const t = data.noteTime[k];
        const dt = t - now;
        if (dt > REPLAY_APPROACH) break;
        const end = data.noteEnd[k];
        const nl = data.noteLanes[k];
        const lane = data.noteLane[k];
        const cx = MARGIN + (lane + 0.5) * laneWidth(nl);
        const headDone = data.noteHit[k] <= now;
        if (end > t) {
          if (data.noteTailHit[k] <= now || end - now < -0.6) continue;
          const yEnd = hitY - ((end - now) / REPLAY_APPROACH) * fall;
          const yHead = headDone ? hitY : hitY - (dt / REPLAY_APPROACH) * fall;
          const top = Math.max(-10, yEnd);
          const bottom = Math.min(h, yHead);
          if (bottom > top) {
            const bw = laneWidth(nl) * 0.32;
            ctx.fillStyle = HOLD_COLORS[lane % HOLD_COLORS.length];
            ctx.fillRect(cx - bw / 2, top, bw, bottom - top);
          }
          if (!headDone) {
            ctx.globalAlpha = dt < 0 ? Math.max(0, 1 + dt / 0.6) : 1;
            drawHead(k, cx, yHead, nl);
            ctx.globalAlpha = 1;
          }
          continue;
        }
        if (headDone || dt < -0.6) continue;
        ctx.globalAlpha = dt < 0 ? Math.max(0, 1 + dt / 0.6) : 1;
        drawHead(k, cx, hitY - (dt / REPLAY_APPROACH) * fall, nl);
        ctx.globalAlpha = 1;
      }

      for (let e = 0; e < data.eventCount; e++) {
        const age = now - data.eventTime[e];
        if (age < 0) break;
        if (age > FLASH) continue;
        const lane = data.eventLane[e];
        if (lane < 0) continue;
        const cx = MARGIN + (lane + 0.5) * laneWidth(data.eventLanes[e]);
        const s = glow[data.eventCode[e]];
        const k = 1 - age / FLASH;
        const scale = 0.7 + (1 - k) * 1.3;
        ctx.globalAlpha = k;
        ctx.drawImage(s.canvas, cx - (s.width * scale) / 2, hitY - (s.height * scale) / 2, s.width * scale, s.height * scale);
      }
      ctx.globalAlpha = 1;

      if (now < lastNow) evCursor = 0;
      lastNow = now;
      while (evCursor < data.eventCount && data.eventTime[evCursor] <= now) evCursor++;
      const sec = Math.floor(now);
      if (sec !== clockSec) {
        clockSec = sec;
        clockStr = formatClock(now);
      }
      ctx.textBaseline = 'alphabetic';
      ctx.font = HUD_FONT_SMALL;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(clockStr, MARGIN + 6, 18);
      ctx.font = HUD_FONT;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(String(evCursor), w - MARGIN - 6, 20);
    };

    const frame = (nowMs: number) => {
      if (!running) return;
      elapsed = (nowMs - t0) / 1000;
      const loopT = elapsed % (len + LOOP_GAP);
      draw(data.range.from + Math.min(loopT, len));
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (running || !visible || !onScreen) return;
      running = true;
      t0 = performance.now() - elapsed * 1000;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) start();
      else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((en) => en.isIntersecting);
          if (onScreen) start();
          else stop();
        },
        { threshold: 0.05 },
      );
      io.observe(canvas);
    }
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (setup() && !running) draw(data.range.from);
      });
      ro.observe(canvas);
    }
    if (setup()) draw(data.range.from);
    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
      ro?.disconnect();
    };
  }, [data]);

  return <canvas ref={ref} className="result-replay-canvas" aria-hidden="true" />;
}
