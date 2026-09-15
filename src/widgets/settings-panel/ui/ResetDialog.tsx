import { useEffect, useId, useRef } from 'react';
import { dict, plural } from '@/shared/i18n';
import { sfxUi } from '@/shared/lib/audio';
import { Coin, CrystalIcon, Disc, Icon, Line, ObjButton, PrimaryAction, Stars } from '@/shared/ui';
import { grandTotalStars, resetProgress, useProgress } from '@/entities/progress';
import { TRACK_IDS } from '@/entities/track';
import { resetOffers } from '@/entities/offers';
import './reset-dialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * «Сбросить прогресс?» (screens-onboard C6): the settings under a veil, a centred panel with the
 * three things the player is about to lose as coins (stars, crystals, tracks with a record), the
 * magenta primary «СБРОСИТЬ / всё пропадёт» and «Отмена». Replaces the system `confirm()`; the
 * reset itself is still `resetProgress()`.
 */
export function ResetDialog({ open, onClose }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const stars = useProgress((s) => grandTotalStars(s, TRACK_IDS));
  const crystals = useProgress((s) => s.crystals);
  const tracks = useProgress((s) => Object.keys(s.tracks).length);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    panelRef.current?.querySelector<HTMLButtonElement>('.rdlg-cancel')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const confirm = () => {
    sfxUi();
    resetProgress();
    // The bought music pack goes with the purchased tracks, so the offer may return.
    resetOffers();
    onClose();
  };
  return (
    <div className="rdlg-dim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className="rdlg" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(e) => e.stopPropagation()}>
        <h2 id={titleId} className="rdlg-title">
          {dict.resetTitle}
        </h2>
        <Line className="rdlg-line">{dict.resetSub}</Line>
        <div className="rdlg-loot">
          <Coin tone="gd" icon={<Stars value={1} max={1} />} value={stars} caption={dict.deckStars} />
          <Coin tone="cy" icon={<CrystalIcon size={20} halo />} value={crystals} caption={dict.resetCrystals} />
          <Coin value={tracks} caption={plural(tracks, dict.tracksNoun)} />
        </div>
        <PrimaryAction
          className="rdlg-primary"
          tone="danger"
          lead={
            <Disc>
              <Icon name="trash" />
            </Disc>
          }
          label={dict.resetVerb}
          sub={dict.resetLoss}
          onClick={confirm}
        />
        <ObjButton className="rdlg-cancel" icon={<Icon name="cross" />} label={dict.shopConfirmNo} onClick={onClose} />
      </div>
    </div>
  );
}
