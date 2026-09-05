import { useState } from 'react';
import { dict } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { PALETTE_SIZE, themeFor } from '@/shared/lib/render';
import { Stars } from '@/shared/ui';
import { CATALOG, TRACK_IDS, loadChart, type TrackMeta } from '@/entities/track';
import { starsForTrack, totalStars, useProgress, type BestResult } from '@/entities/progress';
import { startSession } from '@/entities/play-session';
import './track-list.css';

/** Flat song list, easiest first: one card per song with its rating, mechanics and your best rank. */
export function TrackList() {
  const save = useProgress((s) => s);
  const stars = totalStars(save, TRACK_IDS);
  return (
    <div className="tracklist">
      <div className="tracklist-head">
        <span className="tracklist-total">
          ★ {stars} / {CATALOG.length * 3}
        </span>
        <span className="tracklist-hint">{dict.mechanicsHint}</span>
      </div>
      <div className="tracklist-grid">
        {CATALOG.map((t, i) => (
          <TrackCard key={t.id} index={i + 1} track={t} best={save.tracks[t.id]} />
        ))}
      </div>
    </div>
  );
}

function TrackCard({ index, track, best }: { index: number; track: TrackMeta; best: BestResult | undefined }) {
  const [busy, setBusy] = useState(false);
  const earned = starsForTrack(best);
  const f = track.features;
  const tags = [
    f.laneChanges > 0 && dict.tagLanes,
    f.circles > 0 && dict.tagCircles,
    f.rolls > 0 && dict.tagRolls,
    f.slides > 0 && dict.tagSlides,
    f.holds > 0 && dict.tagHolds,
  ].filter(Boolean) as string[];

  const play = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const chart = await loadChart(track.id);
      startSession(chart, 'catalog');
      navigate('game');
    } finally {
      setBusy(false);
    }
  };

  // Visual theme of the song (genre when the catalog knows it, otherwise deterministic by id).
  const theme = themeFor((track as TrackMeta & { genre?: string }).genre, track.id);

  return (
    <article className="tcard" style={{ ['--tone' as string]: toneFor(track.stars), ['--i' as string]: index - 1 }}>
      <div className="tcard-num">{String(index).padStart(2, '0')}</div>
      <div className="tcard-body">
        <div className="tcard-title">{track.title}</div>
        <div className="tcard-artist">
          {track.artist} · {track.bpm} {dict.bpm} · {Math.round(track.duration)} с
        </div>
        <div className="tcard-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>
        <div
          className="tcard-swatch"
          role="img"
          title={`${dict.themeLabel}: ${theme.name}`}
          aria-label={`${dict.themeLabel}: ${theme.name}`}
        >
          {theme.laneColors.slice(0, PALETTE_SIZE).map((c, k) => (
            <i key={k} style={{ background: c, color: c }} />
          ))}
        </div>
      </div>
      <div className="tcard-side">
        <div className="tcard-stars">★ {track.stars}</div>
        <Stars value={earned} />
        {best && <div className={`tcard-rank rank-${best.rank}`}>{best.rank}</div>}
        <button className="tcard-play" disabled={busy} onClick={() => void play()}>
          {dict.play}
        </button>
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
