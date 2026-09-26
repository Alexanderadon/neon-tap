import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { audioEngine, probeDuration, sfxUi } from '@/shared/lib/audio';
import { readTags } from '@/shared/lib/id3';
import { now } from '@/shared/lib/time';
import { ActionZone, Difficulty, Disc, Icon, Line, ObjButton, PrimaryAction, Stars, SubHeader, Tag, Trio } from '@/shared/ui';
import { CoverScene, TrackCover } from '@/entities/track';
import {
  MAX_FILE_BYTES,
  findSong,
  newSong,
  probedTooLong,
  refreshSongs,
  songIdOf,
  songLengthProblem,
  songTitle,
  useSongs,
  type SongMeta,
} from '@/entities/custom-song';
import { usePassActive } from '@/entities/pass';
import { GENERATOR_VERSION, chartFromBuffer, decodeSongFile, isWeakRhythm, type GenerateProgress, type GeneratedSong } from '@/features/generate-chart';
import { QuotaSheet, checkAddNow, saveSong, type SaveOutcome } from '@/features/song-quota';
import { playCustomSong, playGeneratedSong, releaseSongBuffer } from '@/features/play-custom';
import './drop-zone.css';

/** Why a file was refused (or a saved song could not open — `gone`: deleted in another tab): unreadable, over 40 MB (before reading), over 12 min by its header (before decoding), under 30 s or over 12 min (after decoding). */
type Problem = 'format' | 'big' | 'short' | 'long' | 'gone';

type State =
  | { kind: 'idle'; problem?: Problem }
  | { kind: 'busy'; name: string; progress: GenerateProgress }
  | { kind: 'ready'; song: GeneratedSong; saved: SaveOutcome; weak: boolean }
  /** The file is a song saved already (same fingerprint): it opens as it is, no second analysis. */
  | { kind: 'known'; meta: SongMeta };

const STAGE_WEIGHT: Record<GenerateProgress['stage'], [number, number]> = {
  decode: [0, 0.15],
  onsets: [0.15, 0.7],
  beats: [0.7, 0.8],
  grid: [0.8, 0.9],
  charts: [0.9, 1],
};

const PROBLEM_LINE: Record<Problem, string> = {
  format: dict.wrongFormat,
  big: dict.libTooBig,
  short: dict.libTooShort,
  long: dict.libTooLong,
  gone: dict.libSongGone,
};

interface Props {
  /** «Назад» in the row of three. */
  onBack: () => void;
  /** «Освободить место» on the limit sheet: the list in delete mode. */
  onFreeSpace?: () => void;
}

/** File name without its extension («my-song»). */
const baseName = (name: string) => name.replace(/\.[^.]+$/, '') || name;

/**
 * Adding a song to «Моя музыка» (screens-game.html, frames 16–19): the main screen's skeleton with
 * one card — a placeholder («Твой трек», three grey stars) until a file is chosen, the analysis
 * with its stage bar inside the card, then the finished card with the procedural cover, the flame
 * and «ИГРАТЬ». Before anything is decoded the file is fingerprinted: a song saved already opens
 * as it is, a fourth song without NEON PASS opens the limit sheet. A finished song is saved (title
 * and artist from its tags); when the disk is full or there is no IndexedDB it plays once without
 * being kept. Everything stays local.
 */
export function SongDropZone({ onBack, onFreeSpace }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [limitOpen, setLimitOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const pass = usePassActive();
  const evicted = useSongs((s) => s.evicted);
  const storageOff = useSongs((s) => s.status === 'unavailable');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const run = ++runRef.current;
      const live = () => runRef.current === run;
      const context = audioEngine.ensureContext().catch(() => undefined);
      if (file.size > MAX_FILE_BYTES) {
        setState({ kind: 'idle', problem: 'big' });
        return;
      }
      // Only one decoded song in memory: the last run's buffer goes before this one is decoded.
      releaseSongBuffer();
      const name = baseName(file.name);
      const onProgress = (progress: GenerateProgress) => {
        if (live()) setState({ kind: 'busy', name, progress });
      };
      onProgress({ stage: 'decode', fraction: 0 });
      // The header's length, read while the file is fingerprinted: a 40-minute mix is refused before decoding (≈0.9 GB of PCM).
      const approx = probeDuration(file);
      try {
        await context;
        const id = await songIdOf(file);
        const check = await checkAddNow(id, pass);
        if (!live()) return;
        if (check === 'duplicate') {
          if (!findSong(id)) await refreshSongs();
          const meta = findSong(id);
          if (meta && live()) {
            setState({ kind: 'known', meta });
            return;
          }
        } else if (check === 'limit') {
          setState({ kind: 'idle' });
          setLimitOpen(true);
          return;
        }
        if (probedTooLong(await approx)) {
          if (live()) setState({ kind: 'idle', problem: 'long' });
          return;
        }
        if (!live()) return;
        const tags = readTags(file);
        const buffer = await decodeSongFile(file, onProgress);
        if (!live()) return;
        const problem = songLengthProblem(buffer.duration);
        if (problem) {
          setState({ kind: 'idle', problem });
          return;
        }
        const { title, artist } = songTitle(await tags, file.name);
        const song = await chartFromBuffer(buffer, { id, title, artist }, onProgress);
        if (!live()) return;
        const saved = await saveSong(newSong({ id, chart: song.chart, audio: file, title, artist, generatorVersion: GENERATOR_VERSION, createdAt: now() }), {
          pass,
        });
        if (!live()) return;
        setState({ kind: 'ready', song, saved, weak: isWeakRhythm(song) });
        // Another tab took the last slot meanwhile: the song still plays once.
        if (saved === 'limit') setLimitOpen(true);
      } catch (err) {
        console.error(err);
        if (live()) setState({ kind: 'idle', problem: 'format' });
      }
    },
    [pass],
  );

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

  const play = async () => {
    if (starting) return;
    sfxUi();
    if (state.kind === 'ready') {
      playGeneratedSong(state.song.chart, state.song.audioBuffer, state.saved === 'saved' || state.saved === 'duplicate');
    } else if (state.kind === 'known') {
      setStarting(true);
      // Left meanwhile (the top bar): the song does not open the game over another screen, and its buffer goes.
      const go = () => (mounted.current ? navigate('game') : releaseSongBuffer());
      const outcome = await playCustomSong(state.meta.id, { go });
      if (outcome !== 'ok' && mounted.current) {
        setStarting(false);
        // Deleted in another tab meanwhile: the file can simply be added again.
        if (outcome === 'missing') void refreshSongs();
        setState({ kind: 'idle', problem: outcome === 'missing' ? 'gone' : 'format' });
      }
    }
  };

  const song = state.kind === 'ready' ? state.song : null;
  const known = state.kind === 'known' ? state.meta : null;
  const cardId = song?.chart.id ?? known?.id;
  /** The song on the card is in «Моя музыка» (saved now, or saved before). */
  const kept = known !== null || (state.kind === 'ready' && (state.saved === 'saved' || state.saved === 'duplicate'));
  let subText: string;
  if (state.kind === 'idle') subText = state.problem ? PROBLEM_LINE[state.problem] : evicted ? dict.libEvicted : dict.fileStays;
  else if (song) {
    const n = song.chart.chart.notes.length;
    subText =
      fmt(dict.notesLine, { n, noun: plural(n, dict.notesNoun), bpm: song.chart.bpm }) +
      (state.kind === 'ready' && state.weak ? ` · ${dict.libWeakRhythm}` : '');
  } else if (known) subText = fmt(dict.notesLine, { n: known.notes, noun: plural(known.notes, dict.notesNoun), bpm: known.bpm });
  else subText = dict.fileStays;

  // One line under the card when the song cannot be kept.
  let note: string | null = null;
  if (state.kind === 'ready' && state.saved === 'no-room') note = dict.libNoRoom;
  else if ((state.kind === 'ready' && state.saved === 'unavailable') || (state.kind === 'idle' && storageOff)) note = dict.libNoStorage;

  return (
    <div className="dz" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <CoverScene position="fixed" id={cardId} genre={song?.chart.genre} />
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
      <SubHeader tag={<Tag>{dict.libTitle}</Tag>} text={subText} />

      <div className="dz-stage">
        {state.kind === 'idle' && (
          // The placeholder is a second way to the file picker: a big target that no browser toolbar can cover.
          <button type="button" className="dz-card dz-card-plain dz-card-pick" onClick={choose} aria-label={`${dict.chooseFile} · ${dict.fileFormats}`}>
            <span className="dz-ph" aria-hidden="true">
              <Icon name="note" size={96} strokeWidth={0.5} />
            </span>
            {state.problem === 'format' && (
              <Tag variant="mag" shape="flush" className="dz-flush">
                {dict.readFailed}
              </Tag>
            )}
            <span className="dz-text">
              <span className="dz-title dz-title-dim">{dict.yourTrack}</span>
              <span className="dz-meta">
                <Stars value={0} size="md" />
              </span>
            </span>
          </button>
        )}
        {state.kind === 'busy' && <BusyCard name={state.name} progress={state.progress} />}
        {song && state.kind === 'ready' && (
          <article className="dz-card dz-card-ready">
            <div className="dz-art" aria-hidden="true">
              <TrackCover id={song.chart.id} genre={song.chart.genre} />
            </div>
            {state.saved === 'saved' || state.saved === 'duplicate' ? (
              <Tag shape="flush" className="dz-flush" icon={<Icon name="check" />}>
                {dict.libSavedTag}
              </Tag>
            ) : (
              <Tag variant="dark" shape="flush" className="dz-flush">
                {dict.libOnceTag}
              </Tag>
            )}
            <div className="dz-text">
              <h1 className="dz-title">{song.chart.title}</h1>
              <div className="dz-meta">
                <Stars value={0} size="md" />
                <Difficulty stars={song.chart.chart.stars} />
              </div>
            </div>
          </article>
        )}
        {known && (
          <article className="dz-card dz-card-ready">
            <div className="dz-art" aria-hidden="true">
              <TrackCover id={known.id} />
            </div>
            <Tag shape="flush" className="dz-flush" icon={<Icon name="note" />}>
              {dict.libAlreadyTag}
            </Tag>
            <div className="dz-text">
              <h1 className="dz-title">{known.title}</h1>
              <div className="dz-meta">
                <Stars value={known.best?.stars ?? 0} crowns={Math.min(3, known.best?.crowns ?? 0)} size="md" />
                <Difficulty stars={known.stars} />
              </div>
            </div>
          </article>
        )}
      </div>
      {note && <Line className="dz-note">{note}</Line>}

      <ActionZone className="dz-bottom">
        <Trio>
          {state.kind === 'busy' ? (
            <ObjButton icon={<Icon name="cross" />} label={dict.cancelAnalysis} onClick={cancel} />
          ) : song || known ? (
            // A kept song stays when another file is chosen: «Ещё файл»; «Заменить» only for a song played once without saving.
            <ObjButton icon={<Icon name="file" />} label={kept ? dict.libOtherFile : dict.replaceFile} onClick={choose} disabled={starting} />
          ) : (
            <ObjButton icon={<Icon name="back" />} label={dict.back} onClick={onBack} />
          )}
          <ObjButton
            icon={<Icon name="cap" />}
            label={dict.tutorial}
            disabled={starting}
            onClick={() => {
              sfxUi();
              navigate('tutorial');
            }}
          />
          <ObjButton
            icon={<Icon name="user" />}
            label={dict.profile}
            disabled={starting}
            onClick={() => {
              sfxUi();
              navigate('menu', { view: 'profile' });
            }}
          />
        </Trio>
        {state.kind === 'busy' || starting ? (
          <PrimaryAction
            tone="locked"
            lead={
              <Disc>
                <Icon name="hourglass" />
              </Disc>
            }
            label={state.kind === 'busy' ? dict.analysisWord : dict.loading}
            sub={state.kind === 'busy' ? dict.customStage[state.progress.stage].toLowerCase() : known?.title}
            disabled
          />
        ) : song || known ? (
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="play" />
              </Disc>
            }
            label={dict.play}
            sub={song ? song.chart.title : known?.title}
            beat
            autoFocus
            onClick={() => void play()}
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

      {limitOpen && (
        <QuotaSheet
          onClose={() => setLimitOpen(false)}
          onFree={() => {
            setLimitOpen(false);
            onFreeSpace?.();
          }}
        />
      )}
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
      <Tag shape="flush" className="dz-flush" icon={<Icon name="hourglass" />}>
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
