import { useEffect, useMemo, type ReactNode } from 'react';
import { dict } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { Icon, SubHeader } from '@/shared/ui';
import { useHistory } from '@/entities/history';
import { useProgress } from '@/entities/progress';
import { playedNeighbour } from '../lib/playedNeighbour';

interface Props {
  /** The catalog in deck order: the arrows walk it. */
  ids: readonly string[];
  /** The track whose records are shown. */
  trackId: string;
  /** Another track chosen with an arrow (or ← →). */
  onGo: (id: string) => void;
  /** ← → switch the track too (off while a dialog is over the screen). */
  keys?: boolean;
  /** The centred line: «<b>Metal Song</b> · Глава 1». */
  children: ReactNode;
}

/**
 * The records sub-header: the track and its chapter in one centred line, and ‹ › at the edges that
 * step through the tracks the player has played (any attempt, passed or not), in deck order. The
 * arrows show once there is another played track; at the end of the played ones an arrow greys out.
 */
export function RecordsHeader({ ids, trackId, onGo, keys = true, children }: Props) {
  const attempts = useHistory((h) => h.tracks);
  const bests = useProgress((s) => s.tracks);
  const played = useMemo(() => new Set([...Object.keys(attempts), ...Object.keys(bests)]), [attempts, bests]);
  const prev = playedNeighbour(ids, played, trackId, -1);
  const next = playedNeighbour(ids, played, trackId, 1);
  const go = (id: string | null) => {
    if (!id) return;
    sfxUi();
    onGo(id);
  };

  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : undefined;
      if (to === undefined) return;
      e.preventDefault();
      if (to) {
        sfxUi();
        onGo(to);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys, prev, next, onGo]);

  const arrows = prev !== null || next !== null;
  return (
    <SubHeader center className={arrows ? 'records-head records-head-arrows' : 'records-head'}>
      {arrows && (
        <button type="button" className="records-arrow records-arrow-prev" disabled={!prev} onClick={() => go(prev)} aria-label={dict.recordsPrevAria}>
          <Icon name="chevron" size={20} />
        </button>
      )}
      {children}
      {arrows && (
        <button type="button" className="records-arrow records-arrow-next" disabled={!next} onClick={() => go(next)} aria-label={dict.recordsNextAria}>
          <Icon name="chevron" size={20} />
        </button>
      )}
    </SubHeader>
  );
}
