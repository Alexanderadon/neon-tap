import { useCallback, useRef, useState, type DragEvent } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { audioEngine, sfxUi } from '@/shared/lib/audio';
import { ActionZone, Difficulty, Disc, Icon, ObjButton, PrimaryAction, Stars, SubHeader, Tag, Trio } from '@/shared/ui';
import { CoverScene, TrackCover } from '@/entities/track';
import { startSession } from '@/entities/play-session';
import { generateFromFile, type GenerateProgress, type GeneratedSong } from '@/features/generate-chart';
import './drop-zone.css';

type State = { kind: 'idle'; error?: boolean } | { kind: 'busy'; name: string; progress: GenerateProgress } | { kind: 'ready'; song: GeneratedSong };

const STAGE_WEIGHT: Record<GenerateProgress['stage'], [number, number]> = {
  decode: [0, 0.15],
  onsets: [0.15, 0.7],
  beats: [0.7, 0.8],
  grid: [0.8, 0.9],
  charts: [0.9, 1],
};

interface Props {
  /** «Назад» in the row of three. */
  onBack: () => void;
}

/** File name without its extension («my-song»). */
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;

/**
 * «Своя музыка» (screens-game.html, frames 16–19): the main screen's skeleton with one card —
 * a placeholder («Твой трек», three grey stars) until a file is chosen, the analysis with its
 * stage bar inside the card, then the finished card with the procedural cover, the flame and
 * «ИГРАТЬ». The primary button is the file input; a dropped file works too. Everything stays local.
 */
export function SongDropZone({ onBack }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const fileInput = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    const run = ++runRef.current;
    await audioEngine.ensureContext();
    setState({ kind: 'busy', name: baseName(file.name), progress: { stage: 'decode', fraction: 0 } });
    try {
      const song = await generateFromFile(file, (progress) => {
        if (runRef.current === run) setState({ kind: 'busy', name: baseName(file.name), progress });
      });
      if (runRef.current === run) setState({ kind: 'ready', song });
    } catch (err) {
      console.error(err);
      if (runRef.current === run) setState({ kind: 'idle', error: true });
    }
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const choose = () => {
    sfxUi();
    fileInput.current?.click();
  };

  const cancel = () => {
    sfxUi();
    runRef.current++;
    setState({ kind: 'idle' });
  };

  const play = () => {
    if (state.kind !== 'ready') return;
    sfxUi();
    startSession(state.song.chart, 'custom', state.song.audioBuffer);
    navigate('game');
  };

  const song = state.kind === 'ready' ? state.song : null;
  const notes = song ? song.chart.chart.notes.length : 0;
  const subText =
    state.kind === 'idle' && state.error
      ? dict.wrongFormat
      : song
        ? fmt(dict.notesLine, { n: notes, noun: plural(notes, dict.notesNoun), bpm: song.chart.bpm })
        : dict.fileStays;

  return (
    <div className="dz" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <CoverScene position="fixed" id={song?.chart.id} genre={song?.chart.genre} />
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
      <SubHeader tag={<Tag>{dict.customTitle}</Tag>} text={subText} />

      <div className="dz-stage">
        {state.kind === 'idle' && (
          <article className="dz-card dz-card-plain">
            <span className="dz-ph" aria-hidden="true">
              <Icon name="note" size={96} strokeWidth={0.5} />
            </span>
            {state.error && (
              <Tag variant="mag" shape="flush" className="dz-flush">
                {dict.readFailed}
              </Tag>
            )}
            <div className="dz-text">
              <h1 className="dz-title dz-title-dim">{dict.yourTrack}</h1>
              <div className="dz-meta">
                <Stars value={0} size="md" />
              </div>
            </div>
          </article>
        )}
        {state.kind === 'busy' && <BusyCard name={state.name} progress={state.progress} />}
        {song && (
          <article className="dz-card dz-card-ready">
            <div className="dz-art" aria-hidden="true">
              <TrackCover id={song.chart.id} genre={song.chart.genre} />
            </div>
            <Tag shape="flush" className="dz-flush" icon={<Icon name="sun" />}>
              {dict.readyTag}
            </Tag>
            <div className="dz-text">
              <h1 className="dz-title">{song.chart.title}</h1>
              <div className="dz-meta">
                <Stars value={0} size="md" />
                <Difficulty stars={song.chart.chart.stars} />
              </div>
            </div>
          </article>
        )}
      </div>

      <ActionZone className="dz-bottom">
        <Trio>
          {state.kind === 'busy' ? (
            <ObjButton icon={<Icon name="cross" />} label={dict.cancelAnalysis} onClick={cancel} />
          ) : song ? (
            <ObjButton icon={<Icon name="file" />} label={dict.replaceFile} onClick={choose} />
          ) : (
            <ObjButton icon={<Icon name="back" />} label={dict.back} onClick={onBack} />
          )}
          <ObjButton
            icon={<Icon name="sun" />}
            label={dict.tutorial}
            onClick={() => {
              sfxUi();
              navigate('tutorial');
            }}
          />
          <ObjButton
            icon={<Icon name="user" />}
            label={dict.profile}
            onClick={() => {
              sfxUi();
              navigate('menu', { view: 'profile' });
            }}
          />
        </Trio>
        {state.kind === 'busy' ? (
          <PrimaryAction
            tone="locked"
            lead={
              <Disc>
                <Icon name="hourglass" />
              </Disc>
            }
            label={dict.analysisWord}
            sub={dict.customStage[state.progress.stage].toLowerCase()}
            disabled
          />
        ) : song ? (
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="play" />
              </Disc>
            }
            label={dict.play}
            sub={song.chart.title}
            beat
            autoFocus
            onClick={play}
          />
        ) : (
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="file" />
              </Disc>
            }
            label={dict.chooseFile}
            sub={dict.fileFormats}
            beat
            onClick={choose}
          />
        )}
      </ActionZone>
    </div>
  );
}

/** The analysis card: file name, the stage line with its percentage and the gold bar (the unlock bar inside the card). */
function BusyCard({ name, progress }: { name: string; progress: GenerateProgress }) {
  const [from, to] = STAGE_WEIGHT[progress.stage];
  const value = from + (to - from) * progress.fraction;
  return (
    <article className="dz-card dz-card-plain" aria-busy="true">
      <span className="dz-ph" aria-hidden="true">
        <Icon name="note" size={96} strokeWidth={0.5} />
      </span>
      <Tag shape="flush" className="dz-flush" icon={<Icon name="sun" />}>
        {dict.customAnalyzing}
      </Tag>
      <div className="dz-text">
        <h1 className="dz-title">{name}</h1>
        <div className="dz-cbar">
          <div className="dz-cbar-row">
            <span>{dict.customStage[progress.stage]}</span>
            <b>{Math.round(value * 100)} %</b>
          </div>
          <div className="dz-bar">
            <i style={{ width: `${Math.round(value * 100)}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}
