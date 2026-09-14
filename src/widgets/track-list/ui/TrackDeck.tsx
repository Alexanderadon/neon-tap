import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxSwipe, sfxUi } from '@/shared/lib/audio';
import { velocityOf } from '@/shared/lib/input/gestures';
import { CrystalIcon, Stars } from '@/shared/ui';
import { CATALOG, TrackCover, type TrackMeta } from '@/entities/track';
import { starsForTrack } from '@/entities/progress';
import { lockFor, useCatalogState, type CatalogState, type LockState } from '../model/useCatalogState';
import { usePlayTrack } from '../model/usePlayTrack';
import { readDeckIndex, writeDeckIndex } from '../model/deckPosition';
import { DeckMotion, WINDOW, cardStyle, releaseTarget, rubberBand } from '../model/deckMotion';
import { LockIcon, PlayIcon, StarIcon, SunIcon } from './icons';
import './track-deck.css';

export interface TrackRef {
  id: string;
  title: string;
}

interface Props {
  /** "Records" for the current track (history modal lives in the page). */
  onRecords?: (track: TrackRef) => void;
}

/** Tracks per chapter — the progress dots above the deck. */
const CHAPTER = 10;

const storage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** The card to open with: the first playable track without a result, else the daily one, else the first. */
function startIndex(state: CatalogState): number {
  const next = CATALOG.findIndex((t) => !state.save.tracks[t.id] && lockFor(state, t.id, t.stars).locked === false);
  if (next >= 0) return next;
  const daily = CATALOG.findIndex((t) => t.id === state.dailyId);
  return daily >= 0 ? daily : 0;
}

/**
 * The menu as a deck of cards, one track per card: cover, title, stars, rank — and one big PLAY
 * under the thumb. Swipe (or tap the edge, or use the arrow keys) to flip to the neighbours; a
 * locked card shows what opens it. No lists, no filters, no text walls: a phone game, not a catalog.
 */
export function TrackDeck({ onRecords }: Props) {
  const state = useCatalogState();
  const { busy, play } = usePlayTrack();
  const n = CATALOG.length;
  const [index, setIndex] = useState(() => readDeckIndex(storage(), n) ?? startIndex(state));
  const [details, setDetails] = useState(false);
  /** Motion lives outside React; `index` follows the centre card and is the only render trigger. */
  const motion = useRef<DeckMotion | null>(null);
  if (!motion.current) motion.current = new DeckMotion(index);
  const cards = useRef(new Map<number, HTMLElement>());
  const stageRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const indexRef = useRef(index);
  indexRef.current = index;
  /** Active drag: pointer id, start x, and the last two samples for the release velocity. */
  const pointer = useRef<{ id: number; x: number; prev: { x: number; t: number }; last: { x: number; t: number } } | null>(null);

  /** Write every mounted card's transform from the current position — no React involved. */
  const paint = useCallback(() => {
    const pos = motion.current!.pos();
    for (const [i, el] of cards.current) {
      const st = cardStyle(i - pos);
      el.style.transform = `translate3d(${st.x}%, 0, 0) scale(${st.scale})`;
      el.style.opacity = String(st.opacity);
      el.style.zIndex = String(st.z);
    }
  }, []);

  /** Cards passed since the flight began — each pass plucks a little higher. */
  const passes = useRef(0);

  /** The centre card changed: slide the mounted window (a React render) and pluck. */
  const settleIndex = useCallback((i: number) => {
    if (i === indexRef.current) return;
    indexRef.current = i;
    sfxSwipe(1 + 0.03 * Math.min(8, passes.current++));
    setDetails(false);
    setIndex(i);
    writeDeckIndex(storage(), i);
  }, []);

  const tick = useCallback(
    (now: number) => {
      const m = motion.current!;
      const moving = m.step(now);
      paint();
      settleIndex(Math.round(m.pos()));
      if (moving) raf.current = requestAnimationFrame(tick);
    },
    [paint, settleIndex],
  );

  const flyTo = useCallback(
    (to: number) => {
      cancelAnimationFrame(raf.current);
      passes.current = 0;
      motion.current!.fly(to, performance.now());
      raf.current = requestAnimationFrame(tick);
    },
    [tick],
  );
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // New cards mount (the window slid): place them before the browser paints.
  useLayoutEffect(paint, [index, paint]);

  const track = CATALOG[index];
  const lock = useMemo(() => lockFor(state, track.id, track.stars), [state, track]);

  const go = useCallback((to: number) => flyTo(Math.max(0, Math.min(n - 1, to))), [flyTo, n]);

  /** Card width in px — converts a finger drag into a fraction of a card. */
  const cardPx = () => (stageRef.current ? Math.min(stageRef.current.clientWidth * 0.78, 360) : 300);

  // Swipe: the finger owns the position; release → flight (see deckMotion.ts).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    cancelAnimationFrame(raf.current);
    const sample = { x: e.clientX, t: e.timeStamp };
    pointer.current = { id: e.pointerId, x: e.clientX, prev: sample, last: sample };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    p.prev = p.last;
    p.last = { x: e.clientX, t: e.timeStamp };
    motion.current!.drag(rubberBand(indexRef.current - (e.clientX - p.x) / cardPx(), n));
    paint();
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    pointer.current = null;
    const dx = e.clientX - p.x;
    flyTo(releaseTarget(indexRef.current, motion.current!.pos(), dx, velocityOf(p.prev, { x: e.clientX, t: e.timeStamp }), n));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') go(index + 1);
    else if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay();
    } else return;
    e.preventDefault();
  };

  const onPlay = () => {
    if (busy) return;
    sfxUi();
    if (lock.locked) {
      if (lock.premium) navigate('shop');
      return;
    }
    void play(track.id);
  };

  // Keep the current card in a valid chapter when the catalog changes size (dev only).
  useEffect(() => {
    if (index >= n) setIndex(n - 1);
  }, [index, n]);

  const chapter = Math.floor(index / CHAPTER);
  const chapterTracks = CATALOG.slice(chapter * CHAPTER, chapter * CHAPTER + CHAPTER);

  return (
    <section className="deck" aria-label={dict.deckAria}>
      <header className="deck-head">
        <button type="button" className="deck-chapter micro" onClick={() => go(((chapter + 1) * CHAPTER) % n)} aria-label={dict.deckNextChapter}>
          {fmt(dict.deckChapter, { n: chapter + 1 })}
        </button>
        <ol className="deck-dots" aria-label={fmt(dict.deckChapterProgress, { done: chapterTracks.filter((t) => starsForTrack(state.save.tracks[t.id]) > 0).length, total: chapterTracks.length })}>
          {chapterTracks.map((t, i) => {
            const idx = chapter * CHAPTER + i;
            const done = starsForTrack(state.save.tracks[t.id]) > 0;
            const cls = ['deck-dot', done && 'is-done', idx === index && 'is-current'].filter(Boolean).join(' ');
            return (
              <li key={t.id} className={cls} aria-current={idx === index ? 'true' : undefined}>
                <button type="button" className="deck-dot-hit" onClick={() => go(idx)} aria-label={t.title} />
              </li>
            );
          })}
        </ol>
        <div className="deck-total mono" aria-label={`${dict.deckStars}: ${state.stars}`}>
          <StarIcon size={11} /> {state.stars}
        </div>
      </header>

      <div ref={stageRef} className="deck-stage" tabIndex={0} onKeyDown={onKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {windowCards(index, n).map((i) => {
          const t = CATALOG[i];
          const l = i === index ? lock : lockFor(state, t.id, t.stars);
          return (
            <DeckCard
              key={t.id}
              track={t}
              mount={(el) => (el ? cards.current.set(i, el) : cards.current.delete(i))}
              current={i === index}
              lock={l}
              daily={t.id === state.dailyId}
              best={starsForTrack(state.save.tracks[t.id])}
              rank={state.save.tracks[t.id]?.rank}
              onTap={() => (i === index ? setDetails((d) => !d) : go(i))}
            />
          );
        })}
      </div>

      {details && (
        <div className="deck-details" role="region" aria-label={dict.deckDetails}>
          <div className="deck-tags">
            {[
              track.features.laneChanges > 0 && dict.tagLanes,
              track.features.circles > 0 && dict.tagCircles,
              track.features.rolls > 0 && dict.tagRolls,
              track.features.slides > 0 && dict.tagSlides,
              track.features.holds > 0 && dict.tagHolds,
            ]
              .filter(Boolean)
              .map((tag) => (
                <span key={tag as string} className="deck-tag micro">
                  {tag}
                </span>
              ))}
            <span className="deck-tag deck-tag-genre micro">{dict.genres[track.genre]}</span>
          </div>
          {onRecords && (
            <button type="button" className="deck-link" onClick={() => onRecords({ id: track.id, title: track.title })}>
              {dict.records}
            </button>
          )}
        </div>
      )}

      <div className="deck-play-wrap">
        <button
          type="button"
          className={`deck-play${lock.locked ? ' is-locked' : ''}`}
          onClick={onPlay}
          disabled={busy !== null || (lock.locked && !lock.premium)}
          aria-label={lock.locked ? (lock.premium ? fmt(dict.deckOpenFor, { n: lock.price }) : fmt(dict.deckNeedStars, { n: lock.need })) : fmt(dict.deckPlayAria, { title: track.title })}
        >
          <span className="deck-play-ring" aria-hidden="true" />
          {lock.locked ? (lock.premium ? <CrystalIcon size={30} /> : <LockIcon size={30} />) : <PlayIcon size={40} />}
        </button>
        <div className="deck-play-hint micro">
          {lock.locked ? (
            lock.premium ? (
              <>
                {fmt(dict.deckOpenFor, { n: lock.price })} {plural(lock.price, dict.crystalsNoun)}
              </>
            ) : (
              fmt(dict.deckNeedStars, { n: Math.max(0, lock.need - state.stars) })
            )
          ) : (
            dict.play
          )}
        </div>
      </div>
    </section>
  );
}

/** Cards mounted around the centre: WINDOW on each side, so a flight always has the next card ready. */
function windowCards(index: number, n: number): number[] {
  const out: number[] = [];
  for (let i = index - WINDOW; i <= index + WINDOW; i++) if (i >= 0 && i < n) out.push(i);
  return out;
}

interface CardProps {
  track: TrackMeta;
  /** Registers the element so the motion loop can write its transform. */
  mount: (el: HTMLElement | null) => void;
  /** The centre card (the one PLAY refers to). */
  current: boolean;
  lock: LockState;
  daily: boolean;
  best: number;
  rank?: string;
  onTap: () => void;
}

function DeckCard({ track, mount, current, lock, daily, best, rank, onTap }: CardProps) {
  const cls = ['deck-card', current && 'is-current', lock.locked && 'is-locked', lock.premium && 'is-premium', daily && 'is-daily'].filter(Boolean).join(' ');
  // Position, scale and opacity are written by the motion loop (see paint in TrackDeck).
  return (
    <article ref={mount} className={cls} aria-hidden={current ? undefined : true} onClick={onTap}>
      <div className="deck-art" aria-hidden="true">
        <TrackCover id={track.id} genre={track.genre} />
      </div>
      {daily && (
        <span className="deck-ribbon micro">
          <SunIcon size={10} /> {dict.dailyTrack}
        </span>
      )}
      {lock.locked && (
        <span className="deck-lock" aria-hidden="true">
          {lock.premium ? <CrystalIcon size={28} /> : <LockIcon size={28} />}
          <span className="mono">{lock.premium ? lock.price : `★ ${lock.need}`}</span>
        </span>
      )}
      <div className="deck-text">
        <h1 className="deck-title">{track.title}</h1>
        <div className="deck-meta">
          <Stars value={best} size="md" />
          <span className="deck-diff mono">
            <StarIcon size={11} /> {track.stars}
          </span>
          {rank && <span className={`deck-rank rank-${rank}`}>{rank}</span>}
        </div>
      </div>
    </article>
  );
}
