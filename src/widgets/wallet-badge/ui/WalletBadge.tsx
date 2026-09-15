import { dict, fmt } from '@/shared/i18n';
import { navigate } from '@/shared/lib/router';
import { sfxUi } from '@/shared/lib/audio';
import { Chip, Coin, CrystalIcon } from '@/shared/ui';
import { useProgress } from '@/entities/progress';
import './wallet-badge.css';

interface BadgeProps {
  /** Tapping the badge opens the shop (default) — pass `false` for a plain read-only chip. */
  link?: boolean;
  /** Fixed width (the top bar uses 88 so the digits never move the bar). */
  width?: number;
  className?: string;
}

/** Crystal balance: the 32 px cyan chip (crystal with its halo + the number); a button that leads to the shop. */
export function WalletBadge({ link = true, width, className }: BadgeProps) {
  const crystals = useProgress((s) => s.crystals);
  const label = `${dict.crystalsTitle}: ${crystals}`;
  return (
    <Chip
      variant="cy"
      width={width}
      icon={<CrystalIcon size={16} halo />}
      className={className}
      aria-label={link ? `${label} · ${dict.shop}` : label}
      title={link ? dict.shop : label}
      onClick={
        link
          ? () => {
              sfxUi();
              navigate('shop');
            }
          : undefined
      }
    >
      {crystals}
    </Chip>
  );
}

/** «+N кристаллы» — the reward coin (105 × 56) for the result screen; nothing when there is no reward. */
export function CrystalsEarned({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="crystals-earned" role="status" aria-label={fmt(dict.crystalsEarned, { n })}>
      <Coin tone="cy" icon={<CrystalIcon size={20} halo />} value={`+${n}`} caption={dict.crystalsTitle.toLocaleLowerCase()} animate />
    </span>
  );
}
