import { useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { unlockAllActive } from '@/shared/config/devFlags';
import { Stars } from '@/shared/ui';
import { CATALOG, TRACK_IDS, TrackCover, findTrack, loadChart, type TrackMeta } from '@/entities/track';
import {
  bonusStars,
  dailyTrackId,
  isDailyDone,
  localDateString,
  starsForTrack,
  totalStars,
  unlockStates,
  useProgress,
  type BestResult,
} from '@/entities/progress';
import { startSession } from '@/entities/play-session';
import { playsOf, useHistory } from '@/entities/history';
import './track-list.css';

const DAILY_TONE = '#ffd700';

export interface TrackRef {
  id: string;
  title: string;
}

interface Props {
  /** «Рекорды» on a card was tapped — the page decides how to show the attempt history. */
  onRecords?: (track: TrackRef) => void;
}

/**
 * Flat song list, easiest first: the daily track pinned on top, then one card per song with its
 * rating, mechanics, your best rank and — past the free ones — the stars needed to open it.
 */
export function TrackList({ onRecords }: Props = {}) {
  const save = useProgress((s) => s);
  const trackStars = totalStars(save, TRACK_IDS);
  const bonus = bonusStars(save);
  const stars = trackStars + bonus;
  const today = localDateString();
  const dailyId = dailyTrackId(today, TRACK_IDS);
  const daily = dailyId ? findTrack(dailyId) : undefined;
  const dailyDone = isDailyDone(save.daily, today);
  const unlocks = unlockStates(TRACK_IDS, { stars, dailyId, unlockAll: unlockAllActive() });

  return (
    <div className="tracklist">
      <div className="tracklist-head">
        <span className="tracklist-total">
          ★ {stars}
          <span className="tracklist-breakdown">{fmt(dict.starsBreakdown, { tracks: trackStars, max: CATALOG.length * 3, bonus })}</span>
        </span>
        <span className="tracklist-hint">{dict.mechanicsHint}</span>
      </div>
      <div className="tracklist-grid">
        {daily && <TrackCard track={daily} best={save.tracks[daily.id]} daily={dailyDone ? 'done' : 'open'} streak={save.daily.streak} onRecords={onRecords} />}
        {CATALOG.map((t, i) => (
          <TrackCard key={t.id} index={i + 1} track={t} best={save.tracks[t.id]} need={unlocks[i].unlocked ? 0 : unlocks[i].need} onRecords={onRecords} />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  track: TrackMeta;
  best: BestResult | undefined;
  /** Position in the catalog (hidden on the daily card). */
  index?: number;
  /** Stars still required to open the track; 0 = playable. */
  need?: number;
  /** Pinned daily-track card and whether today's bonus is already claimed. */
  daily?: 'open' | 'done';
  streak?: number;
  onRecords?: (track: TrackRef) => void;
}

function TrackCard({ index, track, best, need = 0, daily, streak = 0, onRecords }: CardProps) {
  const [busy, setBusy] = useState(false);
  const plays = useHistory((h) => playsOf(h, track.id));
  const earned = starsForTrack(best);
  const locked = need > 0;
  const f = track.features;
  const tags = [
    f.laneChanges > 0 && dict.tagLanes,
    f.circles > 0 && dict.tagCircles,
    f.rolls > 0 && dict.tagRolls,
    f.slides > 0 && dict.tagSlides,
    f.holds > 0 && dict.tagHolds,
  ].filter(Boolean) as string[];

  const play = async () => {
    if (busy || locked) return;
    setBusy(true);
    try {
      const chart = await loadChart(track.id);
      startSession(chart, 'catalog');
      navigate('game');
    } finally {
      setBusy(false);
    }
  };

  const cls = ['tcard', daily && 'tcard-daily', locked && 'tcard-locked'].filter(Boolean).join(' ');
  return (
    <article className={cls} style={{ ['--tone' as string]: daily ? DAILY_TONE : toneFor(track.stars) }} aria-disabled={locked || undefined}>
      <div className="tcard-num" aria-hidden="true">
        {daily ? '☀' : locked ? '🔒' : String(index).padStart(2, '0')}
      </div>
      <TrackCover id={track.id} genre={track.genre} title={track.title} className="tcard-cover" />
      <div className="tcard-body">
        {daily && (
          <div className="tcard-daily-label">
            <span className="tcard-daily-badge">{dict.dailyTrack}</span>
            <span className="tcard-daily-hint">{daily === 'done' ? dict.dailyDone : dict.dailyHint}</span>
            {daily === 'done' && streak >= 2 && <span className="tcard-daily-hint">{fmt(dict.dailyStreak, { n: streak })}</span>}
          </div>
        )}
        <div className="tcard-title">{track.title}</div>
        <div className="tcard-genre">
          {dict.genres[track.genre]} · {dict.tempo} {Math.round(track.bpm)} {dict.bpm}
        </div>
        <div className="tcard-artist">
          {track.artist} · {Math.round(track.duration)} с
        </div>
        <div className="tcard-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>
        {onRecords && (
          <button type="button" className="tcard-records" onClick={() => onRecords({ id: track.id, title: track.title })}>
            {dict.records}
            {plays > 0 && <span className="tcard-records-n">{plays}</span>}
          </button>
        )}
      </div>
      <div className="tcard-side">
        <div className="tcard-stars">★ {track.stars}</div>
        <Stars value={earned} />
        {best && <div className={`tcard-rank rank-${best.rank}`}>{best.rank}</div>}
        {locked ? (
          <>
            <div className="tcard-need">{fmt(dict.unlockNeed, { n: need })}</div>
            <button className="tcard-play" disabled>
              {dict.locked}
            </button>
          </>
        ) : (
          <button className="tcard-play" disabled={busy} onClick={() => void play()}>
            {dict.play}
          </button>
        )}
      </div>
    </article>
  );
}

function toneFor(stars: number): string {
  if (stars <= 3) return '#00f0ff';
  if (stars <= 5) return '#b6ff00';
  if (stars <= 7) return '#ff8a00';
  return '#ff2bd6';
}
