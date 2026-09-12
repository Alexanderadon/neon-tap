import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { flickCards, velocityOf } from '@/shared/lib/input/gestures';
import { CrystalIcon, Stars } from '@/shared/ui';
import { CATALOG, TrackCover, type TrackMeta } from '@/entities/track';
import { starsForTrack } from '@/entities/progress';
import { lockFor, useCatalogState, type CatalogState, type LockState } from '../model/useCatalogState';
import { usePlayTrack } from '../model/usePlayTrack';
import { readDeckIndex, writeDeckIndex } from '../model/deckPosition';
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
  /** Where the deck is drawn, in cards (fractional while dragging or flying). */
  const [view, setView] = useState<number>(index);
  const [details, setDetails] = useState(false);
  /** Active drag: pointer id, start x, and the last two samples for the release velocity. */
  const pointer = useRef<{ id: number; x: number; prev: { x: number; t: number }; last: { x: number; t: number } } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  /** Fly from the current view position to card `to`: ease-out, longer for longer trips (220–700 ms). */
  const flyTo = useCallback((to: number) => {
    cancelAnimationFrame(raf.current);
    const from = viewRef.current;
    const dist = Math.abs(to - from);
    if (dist < 0.001) {
      setView(to);
      return;
    }
    const duration = Math.min(700, 220 + 90 * dist);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - k) ** 3;
      setView(from + (to - from) * e);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const track = CATALOG[index];
  const lock = useMemo(() => lockFor(state, track.id, track.stars), [state, track]);

  const go = useCallback(
    (to: number) => {
      const clamped = Math.max(0, Math.min(n - 1, to));
      if (clamped !== index) {
        sfxUi();
        setDetails(false);
        setIndex(clamped);
        writeDeckIndex(storage(), clamped);
      }
      flyTo(clamped);
    },
    [index, n, flyTo],
  );

  /** Card width in px — converts a finger drag into a fraction of a card. */
  const cardPx = () => (stageRef.current ? Math.min(stageRef.current.clientWidth * 0.78, 360) : 300);

  // Swipe: horizontal pointer drag on the deck.
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
    // The deck follows the finger 1:1; past either end it resists (a third of the drag).
    const raw = index - (e.clientX - p.x) / cardPx();
    setView(raw < 0 ? raw / 3 : raw > n - 1 ? n - 1 + (raw - (n - 1)) / 3 : raw);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    pointer.current = null;
    // A flick flies as many cards as its speed earns (see gestures.ts); a slow drag flips one;
    // a drag past the halfway point settles on the nearer card.
    const dx = e.clientX - p.x;
    const cards = flickCards(dx, velocityOf(p.prev, { x: e.clientX, t: e.timeStamp }));
    go(cards !== 0 ? index + cards : Math.round(viewRef.current));
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
        {visibleCards(view, n).map((i) => {
          const t = CATALOG[i];
          const rel = i - view;
          const l = i === index ? lock : lockFor(state, t.id, t.stars);
          return (
            <DeckCard
              key={t.id}
              track={t}
              rel={rel}
              current={i === index}
              lock={l}
              daily={t.id === state.dailyId}
              best={starsForTrack(state.save.tracks[t.id])}
              rank={state.save.tracks[t.id]?.rank}
              onTap={() => (rel === 0 ? setDetails((d) => !d) : go(i))}
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

/** Cards worth drawing around a fractional position: one beyond each visible neighbour. */
function visibleCards(view: number, n: number): number[] {
  const out: number[] = [];
  for (let i = Math.floor(view) - 1; i <= Math.ceil(view) + 1; i++) if (i >= 0 && i < n) out.push(i);
  return out;
}

interface CardProps {
  track: TrackMeta;
  /** Distance from the view position in cards: 0 = centred, negative = to the left. */
  rel: number;
  /** The settled card (the one PLAY refers to). */
  current: boolean;
  lock: LockState;
  daily: boolean;
  best: number;
  rank?: string;
  onTap: () => void;
}

function DeckCard({ track, rel, current, lock, daily, best, rank, onTap }: CardProps) {
  const cls = ['deck-card', current && 'is-current', lock.locked && 'is-locked', lock.premium && 'is-premium', daily && 'is-daily'].filter(Boolean).join(' ');
  // Every card is placed from the continuous view position, so drags and flights are one motion:
  // 84 % of a card per step, scale and dimming eased in over the first card of distance.
  const away = Math.min(1, Math.abs(rel));
  return (
    <article
      className={cls}
      style={{
        transform: `translateX(${rel * 84}%) scale(${1 - 0.12 * away})`,
        opacity: 1 - 0.45 * away,
        filter: `saturate(${1 - 0.4 * away})`,
        zIndex: 10 - Math.round(Math.abs(rel)),
      }}
      aria-hidden={current ? undefined : true}
      onClick={onTap}
    >
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
          <span className="deck-diff mono">
            <StarIcon size={11} /> {track.stars}
          </span>
          <Stars value={best} />
          {rank && <span className={`deck-rank rank-${rank}`}>{rank}</span>}
        </div>
      </div>
    </article>
  );
}
