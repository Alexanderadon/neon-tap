import { useEffect, useId, useRef, useState } from 'react';
import { dict, fmt } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { Coin, Disc, FlameIcon, Icon, Line, ObjButton, PrimaryAction, Sheet, TextField, Thumb, difficultyColor } from '@/shared/ui';
import { TITLE_MAX, removeSong, renameSong, useSong, type SongMeta } from '@/entities/custom-song';
import { formatClock } from '@/entities/score';
import { TrackCover } from '@/entities/track';

interface Props {
  id: string;
  /** Open straight on the delete confirmation (delete mode). */
  confirmDelete?: boolean;
  onPlay: (song: SongMeta) => void;
  onDeleted: () => void;
  onClose: () => void;
}

type Stage = 'details' | 'rename' | 'delete';

/**
 * The song's sheet («⋯»): the cover 96, the artist, three coins (BPM · длина · сложность), the
 * date it was added, «Переименовать» and «Удалить», then «Закрыть» and «ИГРАТЬ». Rename edits the
 * title in place; delete asks once more («рекорд пропадёт»).
 */
export function SongSheet({ id, confirmDelete = false, onPlay, onDeleted, onClose }: Props) {
  const song = useSong(id);
  const titleId = useId();
  const [stage, setStage] = useState<Stage>(confirmDelete ? 'delete' : 'details');
  const [draft, setDraft] = useState(song?.title ?? '');
  const [working, setWorking] = useState(false);
  /** The last rename / delete failed in the storage: one calm line, the stage stays so the tap can be repeated. */
  const [failed, setFailed] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The details focus «ИГРАТЬ»; the delete confirmation focuses «Отмена» — a double Enter never deletes a song and its record.
  useEffect(() => {
    if (stage === 'details') primaryRef.current?.focus();
    else if (stage === 'delete') cancelRef.current?.focus();
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

  const cover = (
    <div className="mm-sheet-cover" aria-hidden="true">
      <TrackCover id={song.id} title={song.title} />
    </div>
  );

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
      <Line className="mm-sheet-line">{fmt(dict.libAddedOn, { date: added })}</Line>
      <div className="mm-sheet-rows">
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
