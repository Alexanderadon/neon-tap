import type { ReactNode } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { PALETTE_SIZE, themeFor } from '@/shared/lib/render';
import { Button, CrystalIcon, Stars } from '@/shared/ui';
import { TrackCover, findTrack } from '@/entities/track';
import { starsForTrack } from '@/entities/progress';
import { playsOf, useHistory } from '@/entities/history';
import { toneFor } from '../lib/reel';
import { lockFor, useCatalogState } from '../model/useCatalogState';
import { usePlayTrack } from '../model/usePlayTrack';
import { LockIcon, PlayIcon, StarIcon, SunIcon, TapIcon, TrophyIcon, WaveIcon } from './icons';
import type { TrackRef } from './TrackList';
import './track-list.css';

const DAILY_TONE = '#ffd700';

interface Props {
  /** Track shown in the hero — the daily track by default, or whatever the reel selected. */
  trackId: string;
  /** Rendered in the hero's top bar, left of the star total (the page passes its wordmark). */
  top?: ReactNode;
  /** «Рекорды» — the page opens the attempt history. */
  onRecords?: (track: TrackRef) => void;
}

/**
 * Full-bleed "now selected" panel: the cover enlarged and blurred as the background, the title in
 * the display face, numbers in the mono face, one huge round PLAY with a pulsing ring, and the two
 * secondary entry points (tutorial, custom song) tucked under it.
 */
export function TrackHero({ trackId, top, onRecords }: Props) {
  const state = useCatalogState();
  const { busy, play } = usePlayTrack();
  const track = findTrack(trackId);
  const plays = useHistory((h) => (track ? playsOf(h, track.id) : 0));
  if (!track) return null;

  const best = state.save.tracks[track.id];
  const earned = starsForTrack(best);
  const { locked, need, premium, price } = lockFor(state, track.id, track.stars);
  const isDaily = track.id === state.dailyId;
  const tone = isDaily ? DAILY_TONE : toneFor(track.stars);
  const theme = themeFor(track.genre, track.id);
  const f = track.features;
  const tags = [
    f.laneChanges > 0 && dict.tagLanes,
    f.circles > 0 && dict.tagCircles,
    f.rolls > 0 && dict.tagRolls,
    f.slides > 0 && dict.tagSlides,
    f.holds > 0 && dict.tagHolds,
  ].filter(Boolean) as string[];
  const label = [isDaily ? dict.menuHeroDaily : dict.menuHeroPick, locked && dict.menuHeroLocked].filter(Boolean).join(' · ');

  const onPlay = () => {
    if (busy) return;
    if (locked) {
      if (premium) {
        sfxUi();
        navigate('shop');
      }
      return;
    }
    sfxUi();
    void play(track.id);
  };

  const cls = ['hero', isDaily && 'hero-daily', locked && 'hero-locked'].filter(Boolean).join(' ');
  return (
    <section className={cls} style={{ ['--tone' as string]: tone }} aria-labelledby="hero-title">
      {/* Cover art, enlarged and blurred, is the only background this panel has — the veil keeps text legible. */}
      <div className="hero-bg" aria-hidden="true" key={track.id}>
        <TrackCover id={track.id} genre={track.genre} size="170%" />
      </div>
      <div className="hero-veil" aria-hidden="true" />
      <div className="hero-scan" aria-hidden="true" />

      <div className="hero-top">
        {top}
        <div
          className="hero-stars"
          role="img"
          title={fmt(dict.starsBreakdown, { tracks: state.trackStars, max: state.maxTrackStars, bonus: state.bonus })}
          aria-label={`${dict.menuStarsTotal}: ${state.stars}`}
        >
          <span className="micro">{dict.menuStarsTotal}</span>
          <StarIcon size={14} />
          <b className="mono">{state.stars}</b>
        </div>
      </div>

      <div className="hero-body">
        <div className="hero-label micro">
          {isDaily && <SunIcon size={12} />}
          {label}
        </div>
        <div className="hero-head">
          <TrackCover id={track.id} genre={track.genre} title={track.title} className="hero-cover" />
          <div className="hero-titles">
            <h2 className="hero-title" id="hero-title">
              {track.title}
            </h2>
            <div className="hero-artist">{track.artist}</div>
            <div className="hero-meta mono">
              <span>{dict.genres[track.genre]}</span>
              <i aria-hidden="true" />
              <span>
                {Math.round(track.bpm)} {dict.bpm}
              </span>
              <i aria-hidden="true" />
              <span>{formatDuration(track.duration)}</span>
            </div>
          </div>
        </div>

        <div className="hero-row">
          <span className="hero-diff mono" aria-label={`${dict.stars}: ${track.stars}`}>
            <StarIcon size={14} /> {track.stars}
          </span>
          <Stars value={earned} />
          {best ? (
            <span className={`hero-rank rank-${best.rank}`} aria-label={fmt(dict.menuCardBest, { rank: best.rank })}>
              <span className="micro">{dict.menuHeroBest}</span>
              {best.rank}
            </span>
          ) : (
            <span className="hero-nobest micro">{dict.menuHeroNoBest}</span>
          )}
          {onRecords && (
            <button type="button" className="hero-records" onClick={() => onRecords({ id: track.id, title: track.title })}>
              <TrophyIcon size={14} />
              {dict.records}
              {plays > 0 && <span className="mono">{fmt(dict.menuHeroPlays, { n: plays, noun: plural(plays, dict.playsNoun) })}</span>}
            </button>
          )}
        </div>

        {tags.length > 0 && (
          <div className="hero-tags">
            {tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}

        {isDaily && (
          <div className="hero-daily-hint">
            {state.dailyDone ? dict.dailyDone : dict.dailyHint}
            {state.dailyDone && state.streak >= 2 && <span className="mono"> · {fmt(dict.dailyStreak, { n: state.streak })}</span>}
          </div>
        )}

        <div className="hero-theme" role="img" title={`${dict.themeLabel}: ${theme.name}`} aria-label={`${dict.themeLabel}: ${theme.name}`}>
          <span className="hero-swatch">
            {theme.laneColors.slice(0, PALETTE_SIZE).map((c, k) => (
              <i key={k} style={{ background: c, color: c }} />
            ))}
          </span>
          <span className="micro">{theme.name}</span>
        </div>
      </div>

      <div className="hero-cta">
        <div className="hero-secondary">
          <Button variant="ghost" className="hero-sec" onClick={() => navigate('tutorial')}>
            <TapIcon size={18} />
            {dict.tutorial}
          </Button>
          <Button variant="ghost" className="hero-sec" onClick={() => navigate('custom')}>
            <WaveIcon size={18} />
            {dict.customSong}
          </Button>
        </div>
        <div className="hero-play-wrap">
          <button
            type="button"
            className="hero-play"
            onClick={onPlay}
            disabled={(locked && !premium) || busy !== null}
            aria-label={
              locked
                ? premium
                  ? `${track.title} — ${price} ${plural(price, dict.crystalsNoun)} · ${dict.toShop}`
                  : fmt(dict.menuCardLocked, { title: track.title, n: need })
                : fmt(dict.menuHeroPlayAria, { title: track.title })
            }
          >
            <span className="hero-play-ring" aria-hidden="true" />
            <span className="hero-play-ring hero-play-ring-2" aria-hidden="true" />
            <span className="hero-play-face">
              {locked ? premium ? <CrystalIcon size={34} /> : <LockIcon size={34} /> : <PlayIcon size={44} />}
              <span className="hero-play-text micro">{locked ? (premium ? dict.toShop : dict.locked) : dict.menuHeroPlay}</span>
            </span>
          </button>
          {locked && (
            <div className="hero-unlock mono">
              {premium ? (
                <>
                  <CrystalIcon size={12} /> {price} {plural(price, dict.crystalsNoun)}
                </>
              ) : (
                fmt(dict.menuHeroUnlock, { need, have: state.stars })
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
