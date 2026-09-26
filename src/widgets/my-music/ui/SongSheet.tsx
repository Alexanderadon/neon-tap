import { useEffect, useId, useRef, useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { MAX_STARS } from '@/shared/lib/analysis';
import { navigate } from '@/shared/lib/router';
import { Coin, Disc, FlameIcon, Icon, Line, ObjButton, PrimaryAction, ProgressBar, Sheet, TextField, Thumb, difficultyColor } from '@/shared/ui';
import { TITLE_MAX, refreshSongs, removeSong, renameSong, useSong, type SongMeta } from '@/entities/custom-song';
import { formatClock } from '@/entities/score';
import { TrackCover } from '@/entities/track';
import { progressFraction, type GenerateProgress } from '@/features/generate-chart';
import { releaseSongBuffer } from '@/features/play-custom';
import { playHarder } from '../model/playHarder';

interface Props {
  id: string;
  /** Open straight on the delete confirmation (delete mode). */
  confirmDelete?: boolean;
  onPlay: (song: SongMeta) => void;
  onDeleted: () => void;
  onClose: () => void;
}

type Stage = 'details' | 'rename' | 'delete' | 'harder';

/**
 * The song's sheet («⋯»): the cover 96, the artist, three coins (BPM · длина · сложность), the
 * date it was added, «Сложнее · ★N+1» (below ★6), «Переименовать» and «Удалить», then «Закрыть»
 * and «ИГРАТЬ». Rename edits the title in place; delete asks once more («рекорд пропадёт»);
 * «Сложнее» composes the song again from its saved file one ★ up — the analysis bar in the sheet —
 * and opens the run.
 */
export function SongSheet({ id, confirmDelete = false, onPlay, onDeleted, onClose }: Props) {
  const song = useSong(id);
  const titleId = useId();
  const [stage, setStage] = useState<Stage>(confirmDelete ? 'delete' : 'details');
  const [draft, setDraft] = useState(song?.title ?? '');
  const [working, setWorking] = useState(false);
  /** The last rename / delete failed in the storage: one calm line, the stage stays so the tap can be repeated. */
  const [failed, setFailed] = useState(false);
  /** «Сложнее»: the analysis as it goes. */
  const [harder, setHarder] = useState<GenerateProgress>({ stage: 'decode', fraction: 0 });
  const harderRun = useRef(0);
  const mounted = useRef(true);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The details focus «ИГРАТЬ»; the delete confirmation and «Сложнее» focus «Отмена» — a double Enter never deletes a song and its record.
  useEffect(() => {
    if (stage === 'details') primaryRef.current?.focus();
    else if (stage === 'delete' || stage === 'harder') cancelRef.current?.focus();
  }, [stage]);

  // Deleted meanwhile (another tab refreshed the list): nothing left to show.
  useEffect(() => {
    if (!song && !working) onClose();
  }, [song, working, onClose]);

  if (!song) return null;

  const back = () => {
    sfxUi();
    setFailed(false);
    if (confirmDelete && stage === 'delete') onClose();
    else setStage('details');
  };

  const saveName = async () => {
    if (working || !draft.trim()) return;
    sfxUi();
    setWorking(true);
    setFailed(false);
    try {
      // false: the song is gone (another tab) — the sheet closes by itself.
      await renameSong(song.id, draft);
    } catch (err) {
      console.warn('songs: rename failed', err);
      setWorking(false);
      setFailed(true);
      return;
    }
    setWorking(false);
    setStage('details');
  };

  const remove = async () => {
    if (working) return;
    sfxUi();
    setWorking(true);
    setFailed(false);
    try {
      await removeSong(song.id);
      onDeleted();
    } catch (err) {
      console.warn('songs: delete failed', err);
      setWorking(false);
      setFailed(true);
    }
  };

  /** One ★ up from the saved chart («Сложнее» is offered below ★6). */
  const harderStars = Math.min(MAX_STARS, song.stars + 1);
  const startHarder = async () => {
    if (working) return;
    sfxUi();
    const run = ++harderRun.current;
    const live = () => mounted.current && harderRun.current === run;
    setFailed(false);
    setWorking(true);
    setHarder({ stage: 'decode', fraction: 0 });
    setStage('harder');
    const outcome = await playHarder(song.id, harderStars, {
      onProgress: (p) => {
        if (live()) setHarder(p);
      },
      // Left meanwhile (the top bar): the song does not open the game over another screen, and its buffer goes.
      go: () => (mounted.current ? navigate('game') : releaseSongBuffer()),
      live,
    });
    if (outcome === 'ok' || !live()) return;
    setWorking(false);
    setStage('details');
    // Deleted in another tab: the list forgets it and the sheet closes by itself.
    if (outcome === 'missing') void refreshSongs();
    else setFailed(true);
  };
  const cancelHarder = () => {
    sfxUi();
    harderRun.current++;
    setWorking(false);
    setStage('details');
  };

  const cover = (
    <div className="mm-sheet-cover" aria-hidden="true">
      <TrackCover id={song.id} title={song.title} />
    </div>
  );

  if (stage === 'harder') {
    const value = progressFraction(harder);
    return (
      <Sheet titleId={titleId} onClose={onClose}>
        <h2 id={titleId} className="sheet-h1">
          {fmt(dict.libHarder, { n: harderStars })}
        </h2>
        {cover}
        <h3 className="mm-sheet-h2">{song.title}</h3>
        <ProgressBar className="mm-sheet-bar" tone="cyan" value={value} label={dict.customStage[harder.stage]} right={`${Math.round(value * 100)} %`} />
        <div className="sheet-actions">
          <ObjButton ref={cancelRef} icon={<Icon name="cross" size={20} />} label={dict.libCancel} onClick={cancelHarder} />
          <PrimaryAction
            tone="locked"
            lead={
              <Disc>
                <Icon name="hourglass" />
              </Disc>
            }
            label={dict.analysisWord}
            sub={dict.customStage[harder.stage].toLowerCase()}
            disabled
          />
        </div>
      </Sheet>
    );
  }

  if (stage === 'rename') {
    return (
      <Sheet titleId={titleId} onClose={onClose}>
        <h2 id={titleId} className="sheet-h1">
          {dict.libRename}
        </h2>
        <TextField
          className="mm-rename"
          value={draft}
          maxLength={TITLE_MAX}
          aria-label={dict.libRenameAria}
          autoFocus
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            setDraft(e.target.value);
            setFailed(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveName();
          }}
        />
        {failed && <Line className="mm-sheet-line">{dict.libSaveFailed}</Line>}
        <div className="sheet-actions">
          <ObjButton icon={<Icon name="cross" size={20} />} label={dict.libCancel} onClick={back} />
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="check" />
              </Disc>
            }
            label={dict.libSave}
            sub={draft.trim() || song.title}
            disabled={!draft.trim() || working}
            onClick={() => void saveName()}
          />
        </div>
      </Sheet>
    );
  }

  if (stage === 'delete') {
    return (
      <Sheet titleId={titleId} onClose={onClose}>
        <h2 id={titleId} className="sheet-h1">
          {dict.libDeleteTitle}
        </h2>
        {cover}
        <h3 className="mm-sheet-h2">{song.title}</h3>
        {failed && <Line className="mm-sheet-line">{dict.libSaveFailed}</Line>}
        <div className="sheet-actions">
          <ObjButton ref={cancelRef} icon={<Icon name="cross" size={20} />} label={dict.libCancel} onClick={back} />
          <PrimaryAction
            tone="danger"
            lead={
              <Disc>
                <Icon name="trash" />
              </Disc>
            }
            label={dict.libDelete}
            sub={dict.libDeleteSub}
            disabled={working}
            onClick={() => void remove()}
          />
        </div>
      </Sheet>
    );
  }

  const added = new Date(song.createdAt).toLocaleDateString('ru-RU');
  return (
    <Sheet titleId={titleId} onClose={onClose}>
      <h2 id={titleId} className="sheet-h1">
        {song.title}
      </h2>
      {cover}
      {song.artist && (
        <Line strong className="mm-sheet-line">
          {song.artist}
        </Line>
      )}
      <div className="mm-sheet-coins">
        <Coin value={song.bpm} caption={dict.libBpm} />
        <Coin value={formatClock(song.durationSec)} caption={dict.libLength} />
        <Coin icon={<FlameIcon color={difficultyColor(song.stars)} size={20} />} value={song.stars} caption={dict.libLevel} />
      </div>
      <Line className="mm-sheet-line">{failed ? dict.readFailed : fmt(dict.libAddedOn, { date: added })}</Line>
      <div className="mm-sheet-rows">
        {song.stars < MAX_STARS && (
          <ObjButton
            wide
            icon={<Icon name="bolt" />}
            label={fmt(dict.libHarder, { n: harderStars })}
            end={<Icon name="chevron" />}
            onClick={() => void startHarder()}
          />
        )}
        <ObjButton
          wide
          icon={<Icon name="bubble" />}
          label={dict.libRename}
          end={<Icon name="chevron" />}
          onClick={() => {
            sfxUi();
            setDraft(song.title);
            setStage('rename');
          }}
        />
        <ObjButton
          wide
          danger
          icon={<Icon name="trash" />}
          label={dict.libDelete}
          end={<Icon name="chevron" />}
          onClick={() => {
            sfxUi();
            setStage('delete');
          }}
        />
      </div>
      <div className="sheet-actions">
        <ObjButton icon={<Icon name="cross" size={20} />} label={dict.libClose} onClick={onClose} />
        <PrimaryAction
          ref={primaryRef}
          lead={
            <Thumb>
              <TrackCover id={song.id} title={song.title} />
            </Thumb>
          }
          label={dict.play}
          sub={song.title}
          onClick={() => onPlay(song)}
        />
      </div>
    </Sheet>
  );
}
