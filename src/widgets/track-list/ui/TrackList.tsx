import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import type { Genre } from '@/shared/types/chart';
import { CATALOG, TrackCover, type TrackMeta } from '@/entities/track';
import { starsForTrack, type BestResult } from '@/entities/progress';
import { playsOf, useHistory } from '@/entities/history';
import { SORT_MODES, arrangeTracks, genresOf, stepIndex, toneFor, type GenreFilter, type SortMode } from '../lib/reel';
import { readPrefs, writePrefs } from '../lib/prefs';
import { lockFor, useCatalogState, type LockState } from '../model/useCatalogState';
import { usePlayTrack } from '../model/usePlayTrack';
import { LockIcon, PlayIcon, StarIcon, SunIcon, TrophyIcon } from './icons';
import { navigate } from '@/shared/lib/router';
import { CrystalIcon } from '@/shared/ui';
import './track-list.css';

const DAILY_TONE = '#ffd700';
const CARD_SELECTOR = '.reel-card-main';

export interface TrackRef {
  id: string;
  title: string;
}

interface Props {
  /** «Рекорды» on a card was tapped — the page decides how to show the attempt history. */
  onRecords?: (track: TrackRef) => void;
  /** Track currently shown in the hero; its card is highlighted and scrolled into view. */
  selectedId?: string;
  /** A card was tapped once — the page moves the selection (a second tap on it plays). */
  onSelect?: (track: TrackRef) => void;
}

const SORT_LABELS: Record<SortMode, string> = {
  stars: dict.menuSortStars,
  title: dict.menuSortTitle,
  new: dict.menuSortNew,
};

const GENRES_PRESENT = genresOf(CATALOG);

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * The song reel: genre chips + order toggle above a snap-scrolling strip of square covers (a
 * 3-column grid on wide screens). Tap = select into the hero, tap again = play. Arrow keys walk
 * the strip, Home/End jump to its ends.
 */
export const TrackList = forwardRef<HTMLElement, Props>(function TrackList({ onRecords, selectedId, onSelect }, ref) {
  const state = useCatalogState();
  const { busy, play } = usePlayTrack();
  const [prefs, setPrefs] = useState(() => readPrefs(storage()));
  const stripRef = useRef<HTMLDivElement>(null);

  const played = useCallback((id: string) => state.save.tracks[id] !== undefined, [state.save]);
  const list = useMemo(() => arrangeTracks(CATALOG, { genre: prefs.genre, sort: prefs.sort, played }), [prefs, played]);

  const setGenre = (genre: GenreFilter) => {
    sfxUi();
    const next = { ...prefs, genre };
    setPrefs(next);
    writePrefs(storage(), next);
  };
  const setSort = (sort: SortMode) => {
    sfxUi();
    const next = { ...prefs, sort };
    setPrefs(next);
    writePrefs(storage(), next);
  };

  // Keep the selected card in view horizontally (never vertically — the reel may be below the fold).
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !selectedId) return;
    const card = strip.querySelector<HTMLElement>(`[data-id="${CSS.escape(selectedId)}"]`);
    if (!card || strip.scrollWidth <= strip.clientWidth) return;
    const target = card.offsetLeft - strip.clientWidth / 2 + card.clientWidth / 2;
    strip.scrollLeft = Math.max(0, target);
  }, [selectedId, list]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const strip = stripRef.current;
    const from = (e.target as HTMLElement).closest<HTMLElement>(CARD_SELECTOR);
    if (!strip || !from) return;
    const cards = Array.from(strip.querySelectorAll<HTMLElement>(CARD_SELECTOR));
    const i = cards.indexOf(from);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = stepIndex(i, 1, cards.length);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = stepIndex(i, -1, cards.length);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = cards.length - 1;
    if (next < 0 || next === i) return;
    e.preventDefault();
    cards[next].focus();
  };

  const tap = (t: TrackMeta, lock: LockState) => {
    sfxUi();
    if (t.id === selectedId && !lock.locked) {
      void play(t.id);
      return;
    }
    if (t.id === selectedId && lock.premium) {
      navigate('shop');
      return;
    }
    onSelect?.({ id: t.id, title: t.title });
  };

  return (
    <section className="reel" ref={ref} aria-labelledby="reel-title">
      <div className="reel-head">
        <h2 className="reel-title" id="reel-title">
          {dict.menuReelTitle}
          <span className="reel-count mono">{fmt(dict.menuReelCount, { n: list.length, total: CATALOG.length })}</span>
        </h2>
        <span className="reel-hint micro">{dict.menuReelHint}</span>
      </div>

      <div className="reel-filters">
        <div className="reel-chips" role="radiogroup" aria-label={dict.menuGenreLabel}>
          <Chip active={prefs.genre === null} onClick={() => setGenre(null)}>
            {dict.menuGenreAll}
          </Chip>
          {GENRES_PRESENT.map((g: Genre) => (
            <Chip key={g} active={prefs.genre === g} onClick={() => setGenre(g)}>
              {dict.genres[g]}
            </Chip>
          ))}
        </div>
        <div className="reel-sort" role="radiogroup" aria-label={dict.menuSortLabel}>
          {SORT_MODES.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={prefs.sort === m} className="reel-seg" onClick={() => setSort(m)}>
              {SORT_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="reel-empty">{dict.menuReelEmpty}</p>
      ) : (
        <div className="reel-strip" ref={stripRef} onKeyDown={onKey}>
          {list.map((t) => (
            <ReelCard
              key={t.id}
              index={CATALOG.indexOf(t) + 1}
              track={t}
              best={state.save.tracks[t.id]}
              lock={lockFor(state, t.id, t.stars)}
              daily={t.id === state.dailyId}
              selected={t.id === selectedId}
              busy={busy === t.id}
              onTap={tap}
              onRecords={onRecords}
            />
          ))}
        </div>
      )}
    </section>
  );
});

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} className="reel-chip" onClick={onClick}>
      {children}
    </button>
  );
}

interface CardProps {
  index: number;
  track: TrackMeta;
  best: BestResult | undefined;
  lock: LockState;
  daily: boolean;
  selected: boolean;
  busy: boolean;
  onTap: (track: TrackMeta, lock: LockState) => void;
  onRecords?: (track: TrackRef) => void;
}

function ReelCard({ index, track, best, lock, daily, selected, busy, onTap, onRecords }: CardProps) {
  const plays = useHistory((h) => playsOf(h, track.id));
  const { locked, need, premium, price } = lock;
  const earned = starsForTrack(best);
  const tone = daily ? DAILY_TONE : toneFor(track.stars);
  const aria = locked
    ? premium
      ? `${track.title} — ${price} ${plural(price, dict.crystalsNoun)} · ${dict.toShop}`
      : fmt(dict.menuCardLocked, { title: track.title, n: need })
    : selected
      ? fmt(dict.menuCardPlay, { title: track.title })
      : fmt(dict.menuCardSelect, { title: track.title });
  const cls = ['reel-card', selected && 'is-selected', locked && 'is-locked', premium && 'is-premium', daily && 'is-daily'].filter(Boolean).join(' ');
  return (
    <article className={cls} style={{ ['--tone' as string]: tone }} data-id={track.id}>
      <button
        type="button"
        className="reel-card-main"
        data-id={track.id}
        aria-label={aria}
        aria-current={selected ? 'true' : undefined}
        disabled={busy}
        onClick={() => onTap(track, lock)}
      >
        <span className="reel-card-art" aria-hidden="true">
          <TrackCover id={track.id} genre={track.genre} />
        </span>
        <span className="reel-card-num mono" aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
        {daily && (
          <span className="reel-card-ribbon micro" aria-hidden="true">
            <SunIcon size={10} />
            {dict.menuCardDaily}
          </span>
        )}
        {locked && (
          <span className="reel-card-lock" aria-hidden="true">
            {premium ? <CrystalIcon size={22} /> : <LockIcon size={22} />}
            <span className="mono">{premium ? price : need}</span>
            {premium && <span className="micro">{selected ? dict.toShop : dict.shopPremium}</span>}
          </span>
        )}
        <span className="reel-card-text" aria-hidden="true">
          <span className="reel-card-title">{track.title}</span>
          <span className="reel-card-artist">{track.artist}</span>
          <span className="reel-card-foot">
            <span className="reel-card-diff mono">
              <StarIcon size={10} /> {track.stars}
            </span>
            <span className="reel-card-earned mono">{earned > 0 ? `+${earned}` : ''}</span>
            {best && <span className={`reel-card-rank rank-${best.rank}`}>{best.rank}</span>}
          </span>
        </span>
        {selected && !locked && (
          <span className="reel-card-go micro" aria-hidden="true">
            <PlayIcon size={12} />
            {dict.play}
          </span>
        )}
      </button>
      {onRecords && plays > 0 && (
        <button
          type="button"
          className="reel-card-rec"
          aria-label={fmt(dict.menuCardRecords, { title: track.title })}
          onClick={() => onRecords({ id: track.id, title: track.title })}
        >
          <TrophyIcon size={12} />
          <span className="mono">{plays}</span>
        </button>
      )}
    </article>
  );
}
