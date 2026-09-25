import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { audioEngine, sfxSwipe, sfxUi } from '@/shared/lib/audio';
import { velocityOf } from '@/shared/lib/input/gestures';
import { Chip, CrystalIcon, Difficulty, Icon, Segments, Stars, Tag, type SegmentState } from '@/shared/ui';
import { CATALOG, TrackCover, chapterAt, chapterTitle, coverImage, idsAround, prioritizeCovers, trackTint, type TrackMeta } from '@/entities/track';
import { starsForTrack } from '@/entities/progress';
import { useSongCount } from '@/entities/custom-song';
import { lockFor, useCatalogState, type LockState } from '../model/useCatalogState';
import { writeDeckIndex } from '../model/deckPosition';
import { DECK_SIZE, SLOT_WEEK, isCustomCard, isSlotCard, slotCoverId, trackIndexOf } from '../model/deckCards';
import { DeckMotion, WINDOW, cardStyle, releaseTarget, rubberBand } from '../model/deckMotion';
import { markDropSeen, unseenDrop } from '../model/dropSeen';
import { cardGlow } from '../lib/coverGlow';
import { customSongsLine, dropSoonText } from '../lib/deckText';
import './track-deck.css';

export interface TrackRef {
  id: string;
  title: string;
}

interface Props {
  /** The centre card (controlled: the page keeps it so the primary button and the records screen follow it). */
  index: number;
  onIndexChange: (index: number) => void;
  /** Enter / Space on the stage = the primary action (on the custom card, and a tap on it: the custom-song screen). */
  onPlay?: () => void;
}

const storage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** Finger travel before a press on the stage becomes a drag; below it the press stays a tap on its card. */
const TAP_SLOP_PX = 6;
/** How long «Новый трек недели!» stays over the chapter row (as the shop's toast). */
const TOAST_MS = 2600;

/**
 * The deck: one card per track — cover art edge to edge, title, three stars, the flame and the
 * rank — with the neighbours peeking at the sides; after the weekly tracks the «Новые треки — по
 * понедельникам» card while the next week has no track, and last the «Своя музыка» card.
 * Above it the chapter row: a gold «ГЛАВА N» (or «РОК-ПАК», «ПРЕМИУМ», «НОВИНКИ») tag and one
 * segment per track of the chapter. Swipe (or tap the edge, or use the arrow keys) to flip; tapping
 * the centre card shows what the track is made of. Playing lives in the page's primary button.
 * When the deck opens on a new week's track it says so once («Новый трек недели!»), without an offer.
 */
export function TrackDeck({ index, onIndexChange, onPlay }: Props) {
  const state = useCatalogState();
  const songs = useSongCount();
  const n = DECK_SIZE;
  const [details, setDetails] = useState(false);
  // The new week's toast: only when the page opened the deck on this week's drop (see initialDeckIndex), once per drop.
  const [toast, setToast] = useState<string | null>(() => {
    const fresh = unseenDrop(CATALOG, state, storage());
    return fresh && CATALOG[index]?.id === fresh.id ? fresh.id : null;
  });
  useEffect(() => {
    if (!toast) return;
    markDropSeen(storage(), toast);
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);
  /** Motion lives outside React; `index` follows the centre card and is the only render trigger. */
  const motion = useRef<DeckMotion | null>(null);
  if (!motion.current) motion.current = new DeckMotion(index);
  const cards = useRef(new Map<number, HTMLElement>());
  const raf = useRef(0);
  const indexRef = useRef(index);
  indexRef.current = index;
  const changeRef = useRef(onIndexChange);
  changeRef.current = onIndexChange;
  /** Active drag: pointer id, start x, the last two samples for the release velocity, and whether the stage holds the pointer yet. */
  const pointer = useRef<{ id: number; x: number; prev: { x: number; t: number }; last: { x: number; t: number }; captured: boolean } | null>(null);

  /** Write every mounted card's transform from the current position — no React involved. */
  const paint = useCallback(() => {
    const pos = motion.current!.pos();
    for (const [i, el] of cards.current) {
      const st = cardStyle(i - pos);
      // −50 % centres the card on its own width; the rest is the deck offset in card widths.
      el.style.transform = `translate3d(${st.x - 50}%, 0, 0) scale(${st.scale})`;
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
    changeRef.current(i);
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
  // Keep the pictures ahead of the swipe: the nearest cards first, then the rest of the deck.
  useEffect(() => {
    const ids = CATALOG.map((t) => t.id);
    prioritizeCovers(idsAround(ids, trackIndexOf(index), ids.length));
  }, [index]);
  // New cards mount (the window slid): place them before the browser paints.
  useLayoutEffect(paint, [index, paint]);
  // The page moved the index itself (not via a swipe): fly there.
  useEffect(() => {
    const m = motion.current!;
    if (!m.isFlying() && Math.round(m.pos()) !== index) flyTo(index);
  }, [index, flyTo]);

  const custom = isCustomCard(index);
  const slot = isSlotCard(index);
  const track = CATALOG[trackIndexOf(index)];
  const lock = useMemo(() => lockFor(state, track.id, track.stars), [state, track]);

  const go = useCallback((to: number) => flyTo(Math.max(0, Math.min(n - 1, to))), [flyTo, n]);

  // The sheen on the centre card breathes with the radio: `--radio` = 0 (silent) … 1 (a kick).
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      const el = cards.current.get(indexRef.current);
      if (!el) return;
      const level = audioEngine.isAmbient ? 0.4 + audioEngine.bassLevel() * 0.6 : 0;
      el.style.setProperty('--radio', level.toFixed(2));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Card width in px — converts a finger drag into a fraction of a card. */
  const cardPx = () => {
    const el = cards.current.get(indexRef.current);
    return el ? el.getBoundingClientRect().width || 292 : 292;
  };

  // Swipe: the finger owns the position; release → flight (see deckMotion.ts).
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    cancelAnimationFrame(raf.current);
    const sample = { x: e.clientX, t: e.timeStamp };
    pointer.current = { id: e.pointerId, x: e.clientX, prev: sample, last: sample, captured: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    // Captured only once the press is a drag: a captured press clicks the stage, and a tap must click the card under the finger.
    if (!p.captured && Math.abs(e.clientX - p.x) > TAP_SLOP_PX) {
      p.captured = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
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
    else if (e.key === 'Enter' || e.key === ' ') onPlay?.();
    else return;
    e.preventDefault();
  };

  const chapter = chapterAt(index) ?? { start: 0, end: CATALOG.length, number: 1 };
  const chapterTracks = CATALOG.slice(chapter.start, chapter.end);
  const chapterDone = chapterTracks.filter((t) => starsForTrack(state.save.tracks[t.id]) > 0).length;

  return (
    <section className="deck" aria-label={dict.deckAria}>
      {/* On the custom and the empty-week cards: their own tag, no segments; the tag leads back to chapter 1 (as the last chapter's does). */}
      <header className="deck-head">
        <button
          type="button"
          className="deck-chapter"
          onClick={() => {
            sfxUi();
            go(custom || slot ? 0 : chapter.end % CATALOG.length);
          }}
          aria-label={dict.deckNextChapter}
        >
          <Tag>{custom ? dict.customSong : slot ? dict.dropsChapter : chapterTitle(chapter)}</Tag>
        </button>
        {!custom && !slot && (
          <Segments
            states={chapterTracks.map<SegmentState>((t, i) =>
              chapter.start + i === index ? 'current' : starsForTrack(state.save.tracks[t.id]) > 0 ? 'done' : 'rest',
            )}
            labels={chapterTracks.map((t) => fmt(dict.deckSegmentAria, { title: t.title }))}
            onSelect={(i) => go(chapter.start + i)}
            aria-label={fmt(dict.deckChapterProgress, { done: chapterDone, total: chapterTracks.length })}
          />
        )}
      </header>
      {toast && (
        <div className="deck-toast" role="status">
          {dict.dropNewToast}
        </div>
      )}

      <div
        className="deck-stage"
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {windowCards(index, n).map((i) => {
          const current = i === index;
          const mount = (el: HTMLElement | null) => (el ? cards.current.set(i, el) : cards.current.delete(i));
          if (isCustomCard(i)) {
            return (
              <CustomCard
                key="custom-card"
                mount={mount}
                current={current}
                line={customSongsLine(songs, state.pass)}
                onTap={() => (current ? onPlay?.() : go(i))}
              />
            );
          }
          // Not playable: a tap on it only brings it to the centre.
          if (isSlotCard(i))
            return <SlotCard key="slot-card" week={SLOT_WEEK ?? 0} mount={mount} current={current} onTap={() => (current ? undefined : go(i))} />;
          const t = CATALOG[i];
          return (
            <DeckCard
              key={t.id}
              track={t}
              mount={mount}
              current={current}
              lock={current ? lock : lockFor(state, t.id, t.stars)}
              daily={t.id === state.dailyId}
              best={starsForTrack(state.save.tracks[t.id])}
              crowns={state.save.tracks[t.id]?.crowns ?? 0}
              loop={state.save.tracks[t.id]?.loop ?? 0}
              rank={state.save.tracks[t.id]?.rank}
              nowMs={state.nowMs}
              details={current && details}
              onTap={() => (current ? setDetails((d) => !d) : go(i))}
            />
          );
        })}
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

interface SlotCardProps {
  /** The schedule week with no track yet — seeds the procedural cover. */
  week: number;
  mount: (el: HTMLElement | null) => void;
  current: boolean;
  onTap: () => void;
}

/**
 * «Новые треки — по понедельникам»: the next week has no track yet. A procedural cover (seeded by the
 * week), dimmed like a locked card, and a promise without a date — no countdown, nothing to play.
 */
function SlotCard({ week, mount, current, onTap }: SlotCardProps) {
  return (
    <article
      ref={mount}
      className={current ? 'deck-card deck-card-slot is-locked is-current' : 'deck-card deck-card-slot is-locked'}
      aria-hidden={current ? undefined : true}
      onClick={onTap}
    >
      <div className="deck-art" aria-hidden="true">
        <TrackCover id={slotCoverId(week)} />
      </div>
      <div className="deck-text">
        <h1 className="deck-title">{dict.dropSlotTitle}</h1>
        <p className="deck-custom-line">{dict.dropSlotLine}</p>
      </div>
    </article>
  );
}

interface CustomCardProps {
  mount: (el: HTMLElement | null) => void;
  current: boolean;
  /** What it does while nothing is saved, then «3 песни · осталось 0 из 3» / «37 песен · PASS». */
  line: string;
  onTap: () => void;
}

/** The last card, «Своя музыка»: the drop zone's placeholder face (a thin note on dark), the title and one line — what it does, or the saved songs. */
function CustomCard({ mount, current, line, onTap }: CustomCardProps) {
  return (
    <article
      ref={mount}
      className={current ? 'deck-card deck-card-custom is-current' : 'deck-card deck-card-custom'}
      aria-hidden={current ? undefined : true}
      onClick={onTap}
    >
      <span className="deck-custom-note" aria-hidden="true">
        <Icon name="note" size={96} strokeWidth={0.5} />
      </span>
      <div className="deck-text">
        <h1 className="deck-title">{dict.customSong}</h1>
        <p className="deck-custom-line">{line}</p>
      </div>
    </article>
  );
}

interface CardProps {
  track: TrackMeta;
  /** Registers the element so the motion loop can write its transform. */
  mount: (el: HTMLElement | null) => void;
  /** The centre card (the one the primary button refers to). */
  current: boolean;
  /** Crowns on the card (endless loops past three stars, three at most). */
  crowns: number;
  /** The farthest endless loop reached (shown once the three crown slots are full). */
  loop: number;
  lock: LockState;
  daily: boolean;
  best: number;
  rank?: string;
  /** The clock of the weekly locks (`CatalogState.nowMs`) — a weekly track's «Выйдет через N дн.». */
  nowMs: number;
  /** Mechanics and genre as a column of dark tags (tap the centre card). */
  details: boolean;
  onTap: () => void;
}

function DeckCard({ track, mount, current, lock, daily, best, crowns, loop, rank, nowMs, details, onTap }: CardProps) {
  const drop = lock.drop;
  const cls = ['deck-card', current && 'is-current', lock.locked && 'is-locked', lock.premium && 'is-premium', drop && 'is-drop', daily && 'is-daily']
    .filter(Boolean)
    .join(' ');
  // The centre card glows in its cover's accent — the picture's tint (spec §2.5); the neighbours only drop a shadow.
  const style: CSSProperties | undefined = current ? { boxShadow: cardGlow(trackTint(track.id, track.genre)) } : undefined;
  const tags: (string | false)[] = [
    track.features.laneChanges > 0 && dict.tagLanes,
    track.features.circles > 0 && dict.tagCircles,
    track.features.rolls > 0 && dict.tagRolls,
    track.features.slides > 0 && dict.tagSlides,
    track.features.holds > 0 && dict.tagHolds,
    dict.genres[track.genre],
  ];
  const shown = tags.filter((t): t is string => typeof t === 'string');
  const gold = rank === 'S' || rank === 'SS';
  // Position, scale and opacity are written by the motion loop (see paint in TrackDeck).
  return (
    <article ref={mount} className={cls} style={style} aria-hidden={current ? undefined : true} onClick={onTap}>
      <div className={coverImage(track.id) ? 'deck-art deck-art-picture' : 'deck-art'} aria-hidden="true">
        <TrackCover id={track.id} genre={track.genre} />
      </div>
      {current && <span className="deck-sheen" aria-hidden="true" />}
      <div className="deck-tags" aria-hidden={details ? undefined : true}>
        {daily && (
          <Tag shape="flush" icon={<Icon name="sun" />}>
            {dict.dailyTrack}
          </Tag>
        )}
        {drop?.thisWeek && <Tag shape="flush">{dict.dropThisWeek}</Tag>}
        {drop?.early && <Tag shape="flush">{dict.dropPassEarly}</Tag>}
        {details && (
          <div className="deck-details" role="region" aria-label={dict.deckDetails}>
            {shown.map((tag) => (
              <Tag key={tag} variant="dark" shape="flush">
                {tag}
              </Tag>
            ))}
          </div>
        )}
      </div>
      {lock.locked && (
        <span className="deck-lock" aria-hidden="true">
          <Icon name="lock" size={32} />
          {drop?.soon ? (
            <Chip variant="dark">{dropSoonText(drop, nowMs)}</Chip>
          ) : lock.premium || drop ? (
            <Chip variant="cy" icon={<CrystalIcon size={16} halo />}>
              {lock.price}
            </Chip>
          ) : (
            <Chip variant="gd" icon={<Stars value={1} max={1} />}>
              {lock.need}
            </Chip>
          )}
        </span>
      )}
      <div className="deck-text">
        <h1 className="deck-title">{track.title}</h1>
        <div className="deck-meta">
          <Stars value={best} crowns={Math.min(3, crowns)} size="md" />
          {crowns >= 3 && loop > 0 && <span className="deck-loop">{fmt(dict.loopOf, { n: loop })}</span>}
          <Difficulty stars={track.stars} />
          {rank && <span className={gold ? 'deck-rank deck-rank-gold' : 'deck-rank'}>{rank}</span>}
        </div>
      </div>
    </article>
  );
}
