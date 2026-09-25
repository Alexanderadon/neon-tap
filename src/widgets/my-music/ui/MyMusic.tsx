import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dict, fmt, plural } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { navigate } from '@/shared/lib/router';
import { formatScore } from '@/shared/lib/format';
import { isIos, isStandaloneDisplay } from '@/shared/lib/pwa';
import {
  ActionZone,
  Disc,
  FrameBody,
  Icon,
  Line,
  ListRow,
  ObjButton,
  PrimaryAction,
  Stars,
  StatePanel,
  SubHeader,
  Tag,
  TextField,
  Thumb,
  Trio,
} from '@/shared/ui';
import { refreshSongs, useSongs, type SongMeta } from '@/entities/custom-song';
import { usePassActive } from '@/entities/pass';
import { TrackCover } from '@/entities/track';
import { playCustomSong, releaseSongBuffer } from '@/features/play-custom';
import { QuotaSheet, songLimit } from '@/features/song-quota';
import { SONG_SORTS, visibleSongs, type SongSort } from '../model/filter';
import { SongSheet } from './SongSheet';
import './my-music.css';

interface Props {
  /** «Назад»: back to the deck. */
  onBack: () => void;
  /** «Добавить» with a free slot: the add view. */
  onAdd: () => void;
  /** Open in delete mode («Освободить место» from the add view's limit sheet). */
  freeMode?: boolean;
}

const SEARCH_DELAY_MS = 150;
const SORT_ICON = { recent: 'hourglass', az: 'book', level: 'bolt' } as const;

/** The order chosen last, kept for this page load. */
let lastSort: SongSort = 'recent';

/** iPhone / iPad in a browser tab: Safari may wipe a site's storage after a week without visits, a home-screen app keeps it. */
function iosInBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  let touch = false;
  try {
    touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch {
    /* ignore */
  }
  return isIos(navigator.userAgent, touch) && !isStandaloneDisplay();
}

type SheetState = { kind: 'details' | 'delete'; id: string } | { kind: 'limit' } | null;

/**
 * «Моя музыка» (the list view): the tag and «2 из 3» / «37 песен · PASS», the search (title or
 * artist, 150 ms), the order (Недавние · А–Я · Сложность), the rows — cover 32, title, best score
 * or «—», stars with crowns — and the dock: «Назад · Добавить · Ещё» over «ИГРАТЬ / song». A tap
 * selects a row; «Ещё» opens the song's details (BPM, length, date, rename, delete). Delete mode
 * («Освободить место») turns the primary into «УДАЛИТЬ». No virtualisation: rows skip layout
 * off screen (`content-visibility: auto`).
 */
export function MyMusic({ onBack, onAdd, freeMode = false }: Props) {
  const songs = useSongs((s) => s.songs);
  const evicted = useSongs((s) => s.evicted);
  const pass = usePassActive();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SongSort>(lastSort);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'play' | 'free'>(freeMode ? 'free' : 'play');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /** The song tapped was deleted in another tab meanwhile: «Песня уже удалена» instead of the count. */
  const [gone, setGone] = useState(false);
  const ios = useMemo(iosInBrowser, []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(text), SEARCH_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [text]);

  const visible = useMemo(() => visibleSongs(songs, query, sort), [songs, query, sort]);
  // The selection follows the visible rows: a song hidden by the search is never played by mistake.
  const selected = (selectedId ? visible.find((s) => s.id === selectedId) : undefined) ?? visible[0] ?? null;
  const limit = songLimit(pass);
  const noun = plural(songs.length, dict.libSongsNoun);
  // More songs than slots (kept from a NEON PASS that has ended — nothing is taken away): «5 песен · мест 3», never «5 из 3».
  const countLine =
    limit === null
      ? fmt(dict.libCountPass, { n: songs.length, noun })
      : songs.length > limit
        ? fmt(dict.libCountOver, { n: songs.length, noun, max: limit })
        : fmt(dict.libCountFree, { n: songs.length, max: limit });

  const chooseSort = (next: SongSort) => {
    sfxUi();
    lastSort = next;
    setSort(next);
  };

  // Stable for the memoised rows: a keystroke in the search re-renders the screen, not 300 rows.
  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFailed(false);
    setGone(false);
  }, []);

  const play = async (song: SongMeta) => {
    if (busy) return;
    sfxUi();
    setBusy(true);
    setFailed(false);
    setGone(false);
    // Left meanwhile (the top bar): the song does not open the game over another screen, and its buffer goes.
    const go = () => (mounted.current ? navigate('game') : releaseSongBuffer());
    const outcome = await playCustomSong(song.id, { go });
    if (outcome === 'ok' || !mounted.current) return; // the game screen replaces this one
    setBusy(false);
    if (outcome === 'missing') {
      void refreshSongs();
      setGone(true);
    } else setFailed(true);
  };

  const add = () => {
    sfxUi();
    if (limit !== null && songs.length >= limit) setSheet({ kind: 'limit' });
    else onAdd();
  };

  const primary = () => {
    if (!selected) return null;
    if (mode === 'free') {
      return (
        <PrimaryAction
          tone="danger"
          lead={
            <Disc>
              <Icon name="trash" />
            </Disc>
          }
          label={dict.libDelete}
          sub={selected.title}
          onClick={() => {
            sfxUi();
            setSheet({ kind: 'delete', id: selected.id });
          }}
        />
      );
    }
    if (busy) {
      return (
        <PrimaryAction
          tone="locked"
          lead={
            <Disc>
              <Icon name="hourglass" />
            </Disc>
          }
          label={dict.loading}
          sub={selected.title}
          disabled
        />
      );
    }
    return (
      <PrimaryAction
        lead={
          <Thumb>
            <TrackCover id={selected.id} title={selected.title} />
          </Thumb>
        }
        label={dict.play}
        sub={selected.title}
        beat
        onClick={() => void play(selected)}
      />
    );
  };

  const subText = mode === 'free' ? dict.libFreeHint : failed ? dict.readFailed : gone ? dict.libSongGone : countLine;

  return (
    <>
      <SubHeader tag={<Tag>{dict.libTitle}</Tag>} text={subText} />
      {songs.length > 0 && (
        <div className="mm-tools">
          <TextField
            value={text}
            placeholder={dict.libSearchPlaceholder}
            aria-label={dict.libSearchAria}
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <Trio role="radiogroup" aria-label={dict.libSortAria}>
            {SONG_SORTS.map((id) => (
              <ObjButton
                key={id}
                role="radio"
                aria-checked={sort === id}
                active={sort === id}
                icon={<Icon name={SORT_ICON[id]} />}
                label={dict.libSort[id]}
                onClick={() => chooseSort(id)}
              />
            ))}
          </Trio>
        </div>
      )}

      <FrameBody scroll className="mm-body">
        {evicted && songs.length === 0 && <Line className="mm-note">{dict.libEvicted}</Line>}
        {songs.length === 0 ? (
          <StatePanel icon={<Icon name="note" size={32} />}>{dict.libEmpty}</StatePanel>
        ) : visible.length === 0 ? (
          <StatePanel icon={<Icon name="note" size={32} />}>{dict.libNoResults}</StatePanel>
        ) : (
          <ol className="mm-list">
            {visible.map((s) => (
              <SongRow key={s.id} song={s} selected={selected?.id === s.id} free={mode === 'free'} disabled={busy} onSelect={select} />
            ))}
          </ol>
        )}
        {ios && <Line className="mm-note">{dict.libIosHint}</Line>}
      </FrameBody>

      <ActionZone className="mm-dock">
        <Trio>
          {mode === 'free' ? (
            <ObjButton
              icon={<Icon name="cross" />}
              label={dict.libCancel}
              onClick={() => {
                sfxUi();
                setMode('play');
              }}
            />
          ) : (
            <ObjButton icon={<Icon name="back" />} label={dict.back} onClick={onBack} disabled={busy} />
          )}
          <ObjButton icon={<Icon name="plus-square" />} label={dict.libAdd} onClick={add} disabled={mode === 'free' || busy} />
          <ObjButton
            icon={<Icon name="sliders" />}
            label={dict.libMore}
            disabled={!selected || busy}
            onClick={() => {
              if (!selected) return;
              sfxUi();
              setSheet({ kind: 'details', id: selected.id });
            }}
          />
        </Trio>
        {primary() ?? (
          <PrimaryAction
            lead={
              <Disc>
                <Icon name="file" />
              </Disc>
            }
            label={dict.libAdd}
            sub={dict.fileFormats}
            beat
            onClick={add}
          />
        )}
      </ActionZone>

      {sheet?.kind === 'limit' && (
        <QuotaSheet
          onClose={() => setSheet(null)}
          onFree={() => {
            setSheet(null);
            setMode('free');
          }}
        />
      )}
      {(sheet?.kind === 'details' || sheet?.kind === 'delete') && (
        <SongSheet
          id={sheet.id}
          confirmDelete={sheet.kind === 'delete'}
          onPlay={(song) => {
            setSheet(null);
            setSelectedId(song.id);
            void play(song);
          }}
          onDeleted={() => {
            setSheet(null);
            setSelectedId(null);
            setMode('play');
          }}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

interface RowProps {
  song: SongMeta;
  selected: boolean;
  /** Delete mode: a trash mark instead of the stars. */
  free: boolean;
  /** A song is loading: the rows wait. */
  disabled: boolean;
  onSelect: (id: string) => void;
}

/** One song: ListRow (cover 32 · title · best or «—» · stars with crowns) under a transparent tap target. Memoised: it re-renders only when its own props change. */
const SongRow = memo(function SongRow({ song, selected, free, disabled, onSelect }: RowProps) {
  const best = song.best;
  return (
    <li className="mm-item">
      <ListRow
        as="div"
        me={selected}
        lead={
          <span className="mm-thumb" aria-hidden="true">
            <TrackCover id={song.id} title={song.title} />
          </span>
        }
        name={song.title}
        score={best ? formatScore(best.score) : dict.libNoBest}
        end={
          free ? (
            <span className="mm-trash" aria-hidden="true">
              <Icon name="trash" size={16} />
            </span>
          ) : (
            <Stars value={best?.stars ?? 0} crowns={Math.min(3, best?.crowns ?? 0)} size="sm" />
          )
        }
      />
      <button
        type="button"
        className="mm-hit"
        aria-pressed={selected}
        aria-label={song.artist ? `${song.title} · ${song.artist}` : song.title}
        disabled={disabled}
        onClick={() => onSelect(song.id)}
      />
    </li>
  );
});
