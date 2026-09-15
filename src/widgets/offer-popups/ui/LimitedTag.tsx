import { dict, fmt } from '@/shared/i18n';
import { store } from '@/shared/lib/iap';
import { sfxUi } from '@/shared/lib/audio';
import { Icon, Tag } from '@/shared/ui';
import { HOUR_MS, hoursLeft } from '@/entities/offers';
import { useLimitedWindow } from '../model/useLimitedWindow';
import './offer-popups.css';

interface Props {
  /** Open the deal's popup. */
  onOpen: () => void;
}

/**
 * The shop header's way to the 48-hour deal: a gold «48 Ч» tag (the hours left, «12 МИН» in the
 * last hour) beside «МАГАЗИН» while the window is open; nothing otherwise, nothing when the store
 * is unavailable.
 */
export function LimitedTag({ onOpen }: Props) {
  const w = useLimitedWindow();
  if (!w || !w.active || !store.available()) return null;
  const text =
    w.remainingMs >= HOUR_MS
      ? fmt(dict.offerHoursShort, { n: hoursLeft(w.remainingMs) })
      : fmt(dict.offerMinutesShort, { n: Math.max(1, Math.ceil(w.remainingMs / 60_000)) });
  return (
    <button
      type="button"
      className="offer-tagbtn"
      aria-label={dict.offerLimitedAria}
      onClick={() => {
        sfxUi();
        onOpen();
      }}
    >
      <Tag icon={<Icon name="hourglass" size={16} />}>{text}</Tag>
    </button>
  );
}
