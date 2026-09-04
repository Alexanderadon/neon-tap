import { useState } from 'react';
import { DIFFICULTIES, type Difficulty } from '@/shared/config/constants';
import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { ProgressBar, Stars } from '@/shared/ui';
import { CATALOG, TRACK_IDS, loadChart, tracksOfWorld, type TrackMeta } from '@/entities/track';
import { WORLDS, isWorldUnlocked, nextLockedWorld, type World } from '@/entities/world';
import { starsForTrack, totalStars, useProgress, type TrackProgress } from '@/entities/progress';
import { startSession } from '@/entities/play-session';
import './world-map.css';

/** Map of 4 worlds → tracks → difficulties. Locked worlds show the star requirement (GDD §1.6). */
export function WorldMap() {
  const save = useProgress((s) => s);
  const stars = totalStars(save, TRACK_IDS);
  const next = nextLockedWorld(stars);
  const maxStars = CATALOG.length * 3;

  return (
    <div className="worldmap">
      <div className="worldmap-progress">
        <ProgressBar
          value={next ? stars / next.requiredStars : 1}
          label={next ? fmt(dict.progressToUnlock, { have: stars, need: next.requiredStars }) : `${dict.allUnlocked} · ★ ${stars} / ${maxStars}`}
          color={next?.color ?? '#ffd700'}
        />
      </div>
      {WORLDS.map((world) => (
        <WorldSection key={world.id} world={world} unlocked={isWorldUnlocked(world, stars)} stars={stars} progress={save.tracks} />
      ))}
    </div>
  );
}

function WorldSection({ world, unlocked, stars, progress }: { world: World; unlocked: boolean; stars: number; progress: Record<string, TrackProgress> }) {
  const tracks = tracksOfWorld(world.id);
  return (
    <section className={`world ${unlocked ? '' : 'world-locked'}`} style={{ ['--world-color' as string]: world.color }}>
      <header className="world-head">
        <h2 className="world-title">{dict.worlds[world.id]}</h2>
        <span className="world-sub">
          ★ {world.starRange[0]}–{world.starRange[1]}
          {!unlocked && <span className="world-lock"> · 🔒 {fmt(dict.needStars, { n: world.requiredStars - stars })}</span>}
        </span>
      </header>
      <div className="world-tracks">
        {tracks.map((t) => (
          <TrackCard key={t.id} track={t} locked={!unlocked} progress={progress[t.id]} />
        ))}
      </div>
    </section>
  );
}

function TrackCard({ track, locked, progress }: { track: TrackMeta; locked: boolean; progress: TrackProgress | undefined }) {
  const [busy, setBusy] = useState<Difficulty | null>(null);
  const earned = starsForTrack(progress);

  const play = async (difficulty: Difficulty) => {
    if (locked || busy) return;
    setBusy(difficulty);
    try {
      const chart = await loadChart(track.id);
      startSession(chart, difficulty, 'catalog');
      navigate('game');
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className={`track ${locked ? 'track-locked' : ''}`}>
      <div className="track-info">
        <div className="track-title">{track.title}</div>
        <div className="track-artist">
          {track.artist} · {track.bpm} {dict.bpm}
        </div>
        <Stars value={earned} />
      </div>
      <div className="track-diffs">
        {DIFFICULTIES.map((d) => {
          const best = progress?.[d];
          return (
            <button key={d} className={`diff diff-${d}`} disabled={locked || busy !== null} onClick={() => play(d)}>
              <span className="diff-name">{dict.difficulty[d]}</span>
              <span className="diff-stars">★ {track.stars[d]}</span>
              {best && <span className={`diff-rank rank-${best.rank}`}>{best.rank}</span>}
            </button>
          );
        })}
      </div>
    </article>
  );
}
