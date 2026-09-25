import { useEffect, useId, useRef } from 'react';
import { dict } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { Disc, Icon, Line, ObjButton, PrimaryAction, Sheet, Tag } from '@/shared/ui';
import { CUSTOM_FREE_LIMIT, useSongs } from '@/entities/custom-song';
import { TrackCover } from '@/entities/track';
import './quota-sheet.css';

interface Props {
  /** «Освободить место»: the list in delete mode. */
  onFree: () => void;
  /** «Не сейчас» or a tap on the veil. */
  onClose: () => void;
}

/**
 * «Три песни уже твои!» — the fourth song without NEON PASS. The three saved songs' covers, the line
 * on how to add a new one, the PASS perk as a plain tag (no payment exists, so no buy button), then
 * «Не сейчас» and «ОСВОБОДИТЬ МЕСТО». Opened only by the player's own tap on «Добавить» or a file.
 */
export function QuotaSheet({ onFree, onClose }: Props) {
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const songs = useSongs((s) => s.songs);
  const covers = songs.slice(-3);
  // More songs than slots (kept after NEON PASS ended): a neutral title, and «удали лишние» — one delete would not be enough.
  const over = songs.length > CUSTOM_FREE_LIMIT;
  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Sheet titleId={titleId} onClose={onClose}>
      <h2 id={titleId} className="sheet-h1">
        {over ? dict.libLimitFullTitle : dict.libLimitTitle}
      </h2>
      {covers.length > 0 && (
        <div className="qs-covers" aria-hidden="true">
          {covers.map((s) => (
            <span key={s.id} className="qs-cover">
              <TrackCover id={s.id} title={s.title} />
            </span>
          ))}
        </div>
      )}
      <Line className="qs-line">{over ? dict.libLimitOverLine : dict.libLimitLine}</Line>
      <Tag variant="dark" className="qs-pass">
        {dict.libLimitPass}
      </Tag>
      <div className="sheet-actions">
        <ObjButton
          icon={<Icon name="cross" size={20} />}
          label={dict.libLimitLater}
          onClick={() => {
            sfxUi();
            onClose();
          }}
        />
        <PrimaryAction
          ref={primaryRef}
          lead={
            <Disc>
              <Icon name="trash" />
            </Disc>
          }
          label={dict.libLimitFree}
          sub={dict.libLimitFreeSub}
          onClick={() => {
            sfxUi();
            onFree();
          }}
        />
      </div>
    </Sheet>
  );
}
