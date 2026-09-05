import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { CrystalIcon } from '@/shared/ui';
import { useProgress } from '@/entities/progress';
import './wallet-badge.css';

interface BadgeProps {
  /** Tapping the badge opens the shop (default) — pass `false` for a plain read-only pill. */
  link?: boolean;
  className?: string;
}

/** Crystal balance pill for the menu header; a button that leads to the shop. */
export function WalletBadge({ link = true, className = '' }: BadgeProps) {
  const crystals = useProgress((s) => s.crystals);
  const label = `${dict.crystalsTitle}: ${crystals}`;
  const body = (
    <>
      <CrystalIcon size={15} />
      <span className="wallet-n">{crystals}</span>
    </>
  );
  if (!link) {
    return (
      <span className={`wallet ${className}`} aria-label={label} title={label}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`wallet wallet-link ${className}`}
      aria-label={`${label} · ${dict.shop}`}
      title={dict.shop}
      onClick={() => {
        sfxUi();
        navigate('shop');
      }}
    >
      {body}
    </button>
  );
}

/** «Кристаллы: +N» — one line for the result screen (pops in with the icon). */
export function CrystalsEarned({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <div className="crystals-earned" role="status">
      <CrystalIcon size={16} />
      <span>{fmt(dict.crystalsEarned, { n })}</span>
    </div>
  );
}
