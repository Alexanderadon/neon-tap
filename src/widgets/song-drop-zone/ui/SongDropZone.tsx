import { useCallback, useRef, useState, type DragEvent } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { audioEngine } from '@/shared/lib/audio';
import { Button, ProgressBar } from '@/shared/ui';
import { startSession } from '@/entities/play-session';
import { generateFromFile, type GenerateProgress, type GeneratedSong } from '@/features/generate-chart';
import './drop-zone.css';

type State =
  | { kind: 'idle'; error?: string }
  | { kind: 'busy'; progress: GenerateProgress }
  | { kind: 'ready'; song: GeneratedSong };

const STAGE_WEIGHT: Record<GenerateProgress['stage'], [number, number]> = {
  decode: [0, 0.15],
  onsets: [0.15, 0.7],
  beats: [0.7, 0.8],
  grid: [0.8, 0.9],
  charts: [0.9, 1],
};

/** "Load your own song" — drag & drop → local analysis → difficulty picker. */
export function SongDropZone() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    await audioEngine.ensureContext();
    setState({ kind: 'busy', progress: { stage: 'decode', fraction: 0 } });
    try {
      const song = await generateFromFile(file, (progress) => setState({ kind: 'busy', progress }));
      setState({ kind: 'ready', song });
    } catch (err) {
      console.error(err);
      setState({ kind: 'idle', error: dict.customError });
    }
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const play = () => {
    if (state.kind !== 'ready') return;
    startSession(state.song.chart, 'custom', state.song.audioBuffer);
    navigate('game');
  };

  if (state.kind === 'busy') {
    const [from, to] = STAGE_WEIGHT[state.progress.stage];
    const value = from + (to - from) * state.progress.fraction;
    return (
      <div className="dropzone dropzone-busy">
        <ProgressBar value={value} label={`${dict.customAnalyzing} ${dict.customStage[state.progress.stage]}`} />
      </div>
    );
  }

  if (state.kind === 'ready') {
    const { song } = state;
    return (
      <div className="dropzone dropzone-ready">
        <div className="dropzone-title">{song.chart.title}</div>
        <div className="dropzone-meta">{fmt(dict.customReady, { bpm: song.chart.bpm, onsets: song.onsets })}</div>
        <div className="dropzone-diffs">
          <Button size="xl" onClick={play}>
            {dict.play} · ★ {song.chart.chart.stars}
            <small>
              {song.chart.chart.notes.length} · {(song.chart.chart.notes.length / song.chart.duration).toFixed(1)} {dict.notesPerSec}
            </small>
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setState({ kind: 'idle' })}>
          {dict.customAnother}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`dropzone ${over ? 'dropzone-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => fileInput.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && fileInput.current?.click()}
    >
      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
      <div className="dropzone-icon">♫</div>
      <div className="dropzone-label">{dict.customDrop}</div>
      {state.error && <div className="dropzone-error">{state.error}</div>}
    </div>
  );
}
